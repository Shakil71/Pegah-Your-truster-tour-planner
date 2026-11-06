import { taka } from "./taka";
import { CommerceMailer } from "../commerce/commerce-mailer.service";
import { ServiceMailer } from "../services/service-mailer.service";
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { formatCalendarDate } from "../common/time";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { EmailService } from "./email.service";
import {
  templates,
  type BookingFacts,
  type RenderedEmail,
  emailLocale,
  type EmailLocale,
} from "./templates";

const BATCH = 20;
const MAX_ATTEMPTS = 5;
const STUCK_MS = 5 * 60_000;

type Payload = Record<string, unknown>;

/**
 * Processes `outbox_events` written in the same transaction as the business
 * change (booking held, confirmed, cancelled, refund paid…) and sends the
 * customer emails. Runs in the API process until the worker exists
 * (ADR-0018/0024). Claims rows with FOR UPDATE SKIP LOCKED, so several API
 * instances never send the same email twice; failures retry with backoff.
 */
@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("Outbox");
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CommerceMailer) private readonly commerce: CommerceMailer,
    @Inject(ServiceMailer) private readonly services: ServiceMailer,
  ) {}

  onModuleInit(): void {
    if (!this.config.RUN_BACKGROUND_JOBS || this.config.OUTBOX_POLL_SECONDS === 0) return;
    this.timer = setInterval(() => void this.tick(), this.config.OUTBOX_POLL_SECONDS * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.drain();
    } catch (error) {
      this.logger.warn({ err: error }, "Outbox tick failed");
    } finally {
      this.running = false;
    }
  }

  /** Processes due events; returns how many were handled. */
  async drain(now: Date = new Date()): Promise<number> {
    const claimed = await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: bigint }[]>`
        SELECT id FROM outbox_events
        WHERE (status = 'PENDING' AND available_at <= ${now})
           OR (status = 'PROCESSING' AND updated_at < ${new Date(now.getTime() - STUCK_MS)})
        ORDER BY id
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED`;
      const ids = rows.map((r) => BigInt(r.id));
      if (ids.length) {
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { status: "PROCESSING" },
        });
      }
      return ids;
    });
    for (const id of claimed) {
      const event = await this.db.outboxEvent.findUniqueOrThrow({ where: { id } });
      try {
        await this.handle(event.eventType, event.aggregateId, event.payload as Payload);
        await this.db.outboxEvent.update({
          where: { id },
          data: {
            status: "DONE",
            processedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
      } catch (error) {
        const attempts = event.attempts + 1;
        const reason = error instanceof Error ? error.message : "failed";
        await this.db.outboxEvent.update({
          where: { id },
          data: {
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            attempts,
            lastError: reason.slice(0, 1000),
            // Exponential backoff: 1, 2, 4, 8 minutes.
            availableAt: new Date(Date.now() + 2 ** (attempts - 1) * 60_000),
          },
        });
      }
    }
    return claimed.length;
  }

  private async handle(type: string, bookingPublicId: string, payload: Payload) {
    // Offers and gift cards (ADR-0032).
    if (this.commerce.handles(type)) return this.commerce.handle(type, bookingPublicId, payload);
    // Visa and flight requests (ADR-0039).
    if (this.services.handles(type)) return this.services.handle(type, bookingPublicId, payload);
    const render = (
      b: BookingFacts,
      l: EmailLocale,
    ): { template: string; mail: RenderedEmail } | null => {
      switch (type) {
        case "booking.held":
          return {
            template: "booking-held",
            mail: templates.bookingHeld(b, dhakaTime(String(payload.holdExpiresAt ?? ""), l), l),
          };
        case "booking.confirmed":
          return { template: "booking-confirmed", mail: templates.bookingConfirmed(b, l) };
        case "booking.cancellation_requested":
          return {
            template: "cancellation-requested",
            mail: templates.cancellationRequested(b, l),
          };
        case "booking.cancelled":
          return {
            template: "booking-cancelled",
            mail: templates.bookingCancelled(
              b,
              typeof payload.refundMinor === "string" && payload.refundMinor !== "0"
                ? taka(payload.refundMinor, String(payload.currency ?? "BDT"))
                : null,
              l,
              typeof payload.giftCardMinor === "string" && payload.giftCardMinor !== "0"
                ? taka(payload.giftCardMinor, String(payload.currency ?? "BDT"))
                : null,
            ),
          };
        case "booking.cancellation_rejected":
          return {
            template: "cancellation-rejected",
            mail: templates.cancellationRejected(b, String(payload.reason ?? ""), l),
          };
        case "refund.paid":
          return {
            template: "refund-paid",
            mail: templates.refundPaid(
              b,
              taka(String(payload.amountMinor ?? "0"), String(payload.currency ?? "BDT")),
              l,
            ),
          };
        default:
          // Staff-side events (payment.refund_required, payment.review_required): no customer email.
          return null;
      }
    };

    const booking = await this.db.booking.findUnique({
      where: { publicId: bookingPublicId },
      include: { user: { select: { locale: true } } },
    });
    if (!booking) return;
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    const facts: BookingFacts = {
      reference: booking.reference,
      productName: booking.productName,
      startDate: formatCalendarDate(booking.startDate),
      endDate: booking.endDate ? formatCalendarDate(booking.endDate) : null,
      guests: booking.guestCount,
      totalText: taka(booking.totalMinor.toString(), booking.currency),
      contactName: booking.contactName,
      // Agent bookings: the client has no Pegah account, so no account link.
      link:
        base && booking.agentPartnerId === null
          ? `${base}/account/bookings/${booking.publicId}${type === "booking.confirmed" ? "/voucher" : ""}`
          : null,
    };
    const rendered = render(facts, emailLocale(booking.user.locale));
    if (!rendered) return;
    const result = await this.email.send({
      to: booking.contactEmail,
      template: rendered.template,
      bookingId: booking.id,
      ...rendered.mail,
    });
    if (result === "FAILED") throw new Error(`Email ${rendered.template} failed`);
  }
}

export { taka } from "./taka";

function dhakaTime(iso: string, l: EmailLocale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return l === "bn" ? "শিগগিরই" : "soon";
  return new Intl.DateTimeFormat(l === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}
