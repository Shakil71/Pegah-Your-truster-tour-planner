import { Inject, Injectable } from "@nestjs/common";
import type { CustomerDetail, CustomerList, CustomerListQuery } from "@pegah/contracts";
import type { Prisma } from "@pegah/db";
import { decodeCursor, encodeCursor, toBookingSummary } from "../booking/booking.mappers";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** Read-only customer views for support and operations (customer:read). */
@Injectable()
export class CustomerAdminService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

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
      bookingCount: u._count.bookings,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      lifetimeValue: toMoney(value._sum.totalMinor ?? 0n, "BDT"),
      bookings: u.bookings.map(toBookingSummary),
    };
  }
}
