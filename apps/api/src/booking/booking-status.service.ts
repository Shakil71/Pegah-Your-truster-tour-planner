import { Inject, Injectable } from "@nestjs/common";
import type { BookingStatus } from "@pegah/contracts";
import { AuditService } from "../audit/audit.service";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { canTransition, type BookingActor } from "./booking-state-machine";

export interface TransitionCommand {
  bookingPublicId: string;
  to: BookingStatus;
  expectedStatus: BookingStatus;
  actor: { type: BookingActor; userId: bigint | null };
  reason: string | null;
  ipAddress?: string | null;
}

/**
 * The only code path that changes a booking's status. It validates the edge
 * against the state machine, guards against concurrent changes, and writes
 * the history row (and an audit event for staff) in the same transaction.
 */
@Injectable()
export class BookingStatusService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async transition(cmd: TransitionCommand): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { publicId: cmd.bookingPublicId },
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
        data: { status: cmd.to },
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

      if (cmd.actor.type === "STAFF") {
        await this.audit.record(
          {
            actorType: "STAFF",
            actorUserId: cmd.actor.userId,
            action: "booking.status_changed",
            targetType: "booking",
            targetId: cmd.bookingPublicId,
            ipAddress: cmd.ipAddress ?? null,
            metadata: { from, to: cmd.to, reason: cmd.reason },
          },
          tx,
        );
      }
    });
  }
}
