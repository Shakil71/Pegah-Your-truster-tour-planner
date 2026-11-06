import { Inject, Injectable } from "@nestjs/common";
import type { BookingStatus } from "@pegah/contracts";
import { AuditService } from "../audit/audit.service";
import { releaseGiftCardPayments } from "../commerce/gift-card-ledger";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { canTransition, type BookingActor } from "./booking-state-machine";
import { convertActiveHolds, releaseActiveHolds, type Tx } from "./inventory";

export interface TransitionCommand {
  bookingPublicId: string;
  to: BookingStatus;
  expectedStatus: BookingStatus;
  actor: { type: BookingActor; userId: bigint | null };
  reason: string | null;
  ipAddress?: string | null;
  /** For customers: the booking must belong to this user (otherwise 404). */
  ownerUserId?: bigint;
}

/** Statuses that end a booking without a sale: any held inventory goes back on sale. */
const RELEASES_HOLDS: ReadonlySet<BookingStatus> = new Set([
  "EXPIRED",
  "CANCELLED",
  "FAILED",
  "REFUND_PENDING",
]);

/** Before a booking is confirmed, gift card money is only lent to it (ADR-0034). */
const UNCONFIRMED: ReadonlySet<BookingStatus> = new Set([
  "DRAFT",
  "PENDING_AVAILABILITY",
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "MANUAL_REVIEW",
]);
const ENDS_UNSOLD: ReadonlySet<BookingStatus> = new Set(["EXPIRED", "CANCELLED", "FAILED"]);

/**
 * The only code path that changes an existing booking's status. It validates
 * the edge against the state machine, guards against concurrent changes, and
 * writes the history row, hold release and (for staff and customers) an audit
 * event in the same transaction.
 */
@Injectable()
export class BookingStatusService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async transition(cmd: TransitionCommand, now: Date = new Date()): Promise<void> {
    await this.db.$transaction((tx) => this.transitionInTx(tx, cmd, now));
  }

  async transitionInTx(tx: Tx, cmd: TransitionCommand, now: Date = new Date()): Promise<void> {
    const booking = await tx.booking.findFirst({
      where: {
        publicId: cmd.bookingPublicId,
        ...(cmd.ownerUserId !== undefined ? { userId: cmd.ownerUserId } : {}),
      },
      select: { id: true, status: true },
    });
    if (!booking) throw new ProblemException(404, "booking-not-found", "Booking not found");
    const from = booking.status;

    if (from !== cmd.expectedStatus) {
      throw new ProblemException(
        409,
        "booking-status-changed",
        "Booking status changed",
        `The booking is now ${from}. Reload and try again.`,
      );
    }
    if (!canTransition(from, cmd.to, cmd.actor.type)) {
      throw new ProblemException(
        422,
        "illegal-transition",
        "Transition not allowed",
        `A booking cannot move from ${from} to ${cmd.to}.`,
      );
    }

    // Compare-and-set: succeeds only if nobody changed the status meanwhile.
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: from },
      data: {
        status: cmd.to,
        ...(RELEASES_HOLDS.has(cmd.to) || cmd.to === "CONFIRMED" ? { holdExpiresAt: null } : {}),
      },
    });
    if (updated.count !== 1) {
      throw new ProblemException(409, "booking-status-changed", "Booking status changed");
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: booking.id,
        fromStatus: from,
        toStatus: cmd.to,
        actorType: cmd.actor.type,
        actorUserId: cmd.actor.userId,
        reason: cmd.reason,
      },
    });

    const released = RELEASES_HOLDS.has(cmd.to) ? await releaseActiveHolds(tx, booking.id, now) : 0;
    // A confirmed booking owns its inventory: held units become sold.
    const converted = cmd.to === "CONFIRMED" ? await convertActiveHolds(tx, booking.id) : 0;
    // Never sold: gift card money goes back to the cards.
    const giftCardsReleased =
      UNCONFIRMED.has(from) && ENDS_UNSOLD.has(cmd.to)
        ? await releaseGiftCardPayments(tx, booking.id, `Booking ${cmd.to.toLowerCase()}`)
        : 0;

    if (cmd.actor.type !== "SYSTEM") {
      await this.audit.record(
        {
          actorType: cmd.actor.type,
          actorUserId: cmd.actor.userId,
          action: "booking.status_changed",
          targetType: "booking",
          targetId: cmd.bookingPublicId,
          ipAddress: cmd.ipAddress ?? null,
          metadata: {
            from,
            to: cmd.to,
            reason: cmd.reason,
            holdsReleased: released,
            holdsConverted: converted,
            giftCardsReleased,
          },
        },
        tx,
      );
    }
  }
}
