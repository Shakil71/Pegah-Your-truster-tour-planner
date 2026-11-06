import { Inject, Injectable } from "@nestjs/common";
import type {
  CustomerDetail,
  CustomerList,
  CustomerListQuery,
  CustomerStatusUpdate,
} from "@pegah/contracts";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import type { Prisma } from "@pegah/db";
import { decodeCursor, encodeCursor, toBookingSummary } from "../booking/booking.mappers";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** Customer views (customer:read) and account controls (customer:manage, audited). */
@Injectable()
export class CustomerAdminService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async customerId(publicId: string): Promise<bigint> {
    const u = await this.db.user.findFirst({
      where: { publicId, kind: "CUSTOMER" },
      select: { id: true },
    });
    if (!u) throw new ProblemException(404, "customer-not-found", "Customer not found");
    return u.id;
  }

  /** Disables (and signs out) or re-enables a customer. Bookings are untouched. */
  async setStatus(
    publicId: string,
    input: CustomerStatusUpdate,
    actor: AuthContext,
    ip: string | null,
  ): Promise<CustomerDetail> {
    if (input.status === "DISABLED" && !input.reason) {
      throw new ProblemException(422, "reason-required", "Give a reason for disabling the account");
    }
    const id = await this.customerId(publicId);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: input.status } });
      if (input.status === "DISABLED") {
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: input.status === "DISABLED" ? "customer.disabled" : "customer.enabled",
          targetType: "user",
          targetId: publicId,
          ipAddress: ip,
          metadata: input.reason ? { reason: input.reason } : {},
        },
        tx,
      );
    });
    return this.detail(publicId);
  }

  /** Ends every session of the customer (lost phone, shared computer). */
  async signOutEverywhere(
    publicId: string,
    actor: AuthContext,
    ip: string | null,
  ): Promise<{ sessionsEnded: number }> {
    const id = await this.customerId(publicId);
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "customer.signed_out",
          targetType: "user",
          targetId: publicId,
          ipAddress: ip,
          metadata: { sessionsEnded: count },
        },
        tx,
      );
      return { sessionsEnded: count };
    });
  }

  async list(q: CustomerListQuery): Promise<CustomerList> {
    const where: Prisma.UserWhereInput = { kind: "CUSTOMER" };
    if (q.q) {
      where.OR = [
        { email: { startsWith: q.q.toLowerCase() } },
        { fullName: { contains: q.q } },
        { phone: { startsWith: q.q } },
      ];
    }
    const before = decodeCursor(q.cursor);
    if (before !== undefined) where.id = { lt: before };
    const rows = await this.db.user.findMany({
      where,
      orderBy: { id: "desc" },
      take: q.limit + 1,
      include: { _count: { select: { bookings: true } } },
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((u) => ({
        id: u.publicId,
        email: u.email,
        fullName: u.fullName,
        phone: u.phone,
        status: u.status,
        emailVerified: u.emailVerifiedAt !== null,
        bookingCount: u._count.bookings,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > q.limit && page.length > 0 ? encodeCursor(page[page.length - 1]!.id) : null,
    };
  }

  async detail(publicId: string): Promise<CustomerDetail> {
    const u = await this.db.user.findFirst({
      where: { publicId, kind: "CUSTOMER" },
      include: {
        _count: { select: { bookings: true } },
        bookings: { orderBy: { id: "desc" }, take: 50 },
      },
    });
    if (!u) throw new ProblemException(404, "customer-not-found", "Customer not found");
    const value = await this.db.booking.aggregate({
      where: { userId: u.id, status: { in: ["CONFIRMED", "COMPLETED"] }, currency: "BDT" },
      _sum: { totalMinor: true },
    });
    return {
      id: u.publicId,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      status: u.status,
      emailVerified: u.emailVerifiedAt !== null,
      bookingCount: u._count.bookings,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      lifetimeValue: toMoney(value._sum.totalMinor ?? 0n, "BDT"),
      bookings: u.bookings.map(toBookingSummary),
    };
  }
}
