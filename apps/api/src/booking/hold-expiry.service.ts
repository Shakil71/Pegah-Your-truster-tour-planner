import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { HttpException } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { BookingStatusService } from "./booking-status.service";

const BATCH = 50;

/**
 * Expires unpaid bookings whose hold has run out and puts their inventory back
 * on sale. Runs inside the API process on a timer until the dedicated worker
 * exists (ADR-0018). Safe with several API instances: each expiry is a
 * compare-and-set through the state machine, so only one instance wins.
 */
@Injectable()
export class HoldExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("HoldExpiry");
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(BookingStatusService) private readonly status: BookingStatusService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    const seconds = this.config.HOLD_SWEEP_SECONDS;
    if (seconds === 0) return;
    this.timer = setInterval(() => void this.tick(), seconds * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const expired = await this.sweep();
      if (expired > 0) this.logger.log({ expired }, "Expired unpaid bookings");
    } catch (error) {
      // The database may be briefly unavailable; the next tick retries.
      this.logger.warn({ err: error }, "Hold sweep failed");
    } finally {
      this.running = false;
    }
  }

  /** Expires due bookings; returns how many were expired. */
  async sweep(now: Date = new Date()): Promise<number> {
    const due = await this.db.booking.findMany({
      where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
      orderBy: { holdExpiresAt: "asc" },
      take: BATCH,
      select: { publicId: true },
    });
    let expired = 0;
    for (const b of due) {
      try {
        await this.status.transition(
          {
            bookingPublicId: b.publicId,
            to: "EXPIRED",
            expectedStatus: "PENDING_PAYMENT",
            actor: { type: "SYSTEM", userId: null },
            reason: "Payment not completed before the hold expired",
          },
          now,
        );
        expired++;
      } catch (error) {
        // 409: paid or cancelled meanwhile. Anything else is logged and retried later.
        if (!(error instanceof HttpException && error.getStatus() === 409)) throw error;
      }
    }
    return expired;
  }
}
