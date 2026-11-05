import { Inject, Injectable } from "@nestjs/common";
import type {
  AgentStatement,
  CreatePartner,
  PartnerBookingList,
  PartnerMemberInput,
  PartnerOverview,
  PartnerOwnership,
  PartnerView,
  UpdatePartner,
} from "@pegah/contracts";
import { Prisma, type BookingStatus } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext, AuthPartner } from "../auth/auth.types";
import { PasswordService } from "../auth/password.service";
import { decodeCursor, encodeCursor, toBookingSummary } from "../booking/booking.mappers";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

const CONFIRMED: BookingStatus[] = ["CONFIRMED", "COMPLETED"];
const OPEN: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
];
const PARTNER_INCLUDE = {
  members: {
    select: { publicId: true, fullName: true, email: true, status: true },
    orderBy: { fullName: "asc" },
  },
  hotels: { select: { slug: true, name: true }, orderBy: { name: "asc" } },
  tours: { select: { slug: true, title: true }, orderBy: { title: "asc" } },
} as const satisfies Prisma.PartnerInclude;
type PartnerRow = Prisma.PartnerGetPayload<{ include: typeof PARTNER_INCLUDE }>;

const forbidden = (detail: string) => new ProblemException(403, "forbidden", "Forbidden", detail);

/**
 * Partner companies (ADR-0026). Tenancy rule: a partner user only ever sees
 * records owned by their partner — hotels/tours assigned to a supplier, and
 * bookings an agent made. Ownership is part of every query.
 */
@Injectable()
export class PartnerService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ─── Portal ───────────────────────────────────────────────────────────────

  partnerOf(auth: AuthContext, kind?: "SUPPLIER" | "AGENT"): AuthPartner {
    const p = auth.partner;
    if (!p) throw forbidden("A partner account is required.");
    if (kind && p.kind !== kind) {
      throw forbidden(
        kind === "SUPPLIER" ? "Only suppliers can do this." : "Only travel agents can do this.",
      );
    }
    return p;
  }

  async overview(auth: AuthContext, now = new Date()): Promise<PartnerOverview> {
    const p = this.partnerOf(auth);
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const base = {
      partner: { id: p.publicId, kind: p.kind, name: p.name, commissionBps: p.commissionBps },
    };
    if (p.kind === "AGENT") {
      const [count, earned, pending] = await Promise.all([
        this.db.booking.count({ where: { agentPartnerId: p.id, createdAt: { gte: since } } }),
        this.db.booking.aggregate({
          where: { agentPartnerId: p.id, status: { in: CONFIRMED } },
          _sum: { commissionMinor: true },
        }),
        this.db.booking.aggregate({
          where: {
            agentPartnerId: p.id,
            status: { in: ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "MANUAL_REVIEW"] },
          },
          _sum: { commissionMinor: true },
        }),
      ]);
      return {
        ...base,
        supplier: null,
        agent: {
          bookings30d: count,
          commissionEarned: toMoney(earned._sum.commissionMinor ?? 0n, "BDT"),
          commissionPending: toMoney(pending._sum.commissionMinor ?? 0n, "BDT"),
        },
      };
    }
    const [hotels, tours] = await Promise.all([
      this.db.hotel.findMany({
        where: { partnerId: p.id },
        orderBy: { name: "asc" },
        include: {
          rooms: {
            orderBy: { name: "asc" },
            select: { publicId: true, name: true, isActive: true },
          },
        },
      }),
      this.db.tour.findMany({
        where: { partnerId: p.id },
        orderBy: { title: "asc" },
        include: {
          schedules: { where: { departsAt: { gt: now } }, orderBy: { departsAt: "asc" }, take: 20 },
        },
      }),
    ]);
    const owned = this.ownedProducts(p.id);
    const [upcoming, value] = await Promise.all([
      this.db.booking.count({ where: { ...owned, status: { in: OPEN }, startDate: { gte: now } } }),
      this.db.booking.aggregate({
        where: { ...owned, status: { in: CONFIRMED }, createdAt: { gte: since }, currency: "BDT" },
        _sum: { totalMinor: true },
      }),
    ]);
    return {
      ...base,
      agent: null,
      supplier: {
        hotels: hotels.map((h) => ({
          slug: h.slug,
          name: h.name,
          status: h.status,
          rooms: h.rooms.map((r) => ({ id: r.publicId, name: r.name, isActive: r.isActive })),
        })),
        tours: tours.map((t) => ({
          slug: t.slug,
          title: t.title,
          status: t.status,
          departures: t.schedules.map((s) => ({
            id: s.publicId,
            departsAt: s.departsAt.toISOString(),
            returnsAt: s.returnsAt.toISOString(),
            capacity: s.capacity,
            held: s.held,
            sold: s.sold,
            priceAdult: toMoney(s.priceAdultMinor, s.currency),
            priceChild: toMoney(s.priceChildMinor, s.currency),
            status: s.status,
          })),
        })),
        upcomingReservations: upcoming,
        confirmedValue30d: toMoney(value._sum.totalMinor ?? 0n, "BDT"),
      },
    };
  }

  /** Bookings for a supplier's hotels and tours (no cancelled-before-payment noise). */
  async reservations(auth: AuthContext, cursor?: string, limit = 30): Promise<PartnerBookingList> {
    const p = this.partnerOf(auth, "SUPPLIER");
    return this.page(
      { ...this.ownedProducts(p.id), status: { notIn: ["DRAFT", "EXPIRED", "FAILED"] } },
      cursor,
      limit,
    );
  }

  async agentBookings(auth: AuthContext, cursor?: string, limit = 30): Promise<PartnerBookingList> {
    const p = this.partnerOf(auth, "AGENT");
    return this.page({ agentPartnerId: p.id }, cursor, limit);
  }

  async statement(auth: AuthContext, month: string): Promise<AgentStatement> {
    const p = this.partnerOf(auth, "AGENT");
    const [y, m] = month.split("-").map(Number) as [number, number];
    // Dhaka month boundaries (UTC+6, no DST).
    const start = new Date(Date.UTC(y, m - 1, 1) - 6 * 3_600_000);
    const end = new Date(Date.UTC(y, m, 1) - 6 * 3_600_000);
    const rows = await this.db.booking.findMany({
      where: { agentPartnerId: p.id, createdAt: { gte: start, lt: end } },
      orderBy: { id: "asc" },
    });
    let value = 0n;
    let commission = 0n;
    for (const b of rows) {
      if (CONFIRMED.includes(b.status)) {
        value += b.totalMinor;
        commission += b.commissionMinor;
      }
    }
    return {
      month,
      items: rows.map((b) => ({
        id: b.publicId,
        reference: b.reference,
        productName: b.productName,
        status: b.status,
        total: toMoney(b.totalMinor, b.currency),
        commission: toMoney(CONFIRMED.includes(b.status) ? b.commissionMinor : 0n, b.currency),
        createdAt: b.createdAt.toISOString(),
      })),
      totals: {
        bookings: rows.length,
        confirmedValue: toMoney(value, "BDT"),
        commissionEarned: toMoney(commission, "BDT"),
      },
    };
  }

  /** Throws unless the room belongs to a hotel this supplier manages. */
  async assertOwnsRoom(auth: AuthContext, roomPublicId: string): Promise<void> {
    const p = this.partnerOf(auth, "SUPPLIER");
    const ok = await this.db.hotelRoom.count({
      where: { publicId: roomPublicId, hotel: { partnerId: p.id } },
    });
    if (!ok) throw new ProblemException(404, "room-not-found", "Room not found");
  }

  async assertOwnsDeparture(auth: AuthContext, departurePublicId: string): Promise<void> {
    const p = this.partnerOf(auth, "SUPPLIER");
    const ok = await this.db.tourSchedule.count({
      where: { publicId: departurePublicId, tour: { partnerId: p.id } },
    });
    if (!ok) throw new ProblemException(404, "departure-not-found", "Departure not found");
  }

  async assertAgentBooking(auth: AuthContext, bookingPublicId: string): Promise<void> {
    const p = this.partnerOf(auth, "AGENT");
    const ok = await this.db.booking.count({
      where: { publicId: bookingPublicId, agentPartnerId: p.id },
    });
    if (!ok) throw new ProblemException(404, "booking-not-found", "Booking not found");
  }

  private ownedProducts(partnerId: bigint): Prisma.BookingWhereInput {
    return {
      items: {
        some: {
          OR: [{ hotelRoom: { hotel: { partnerId } } }, { tourSchedule: { tour: { partnerId } } }],
        },
      },
    };
  }

  private async page(
    where: Prisma.BookingWhereInput,
    cursor: string | undefined,
    limit: number,
  ): Promise<PartnerBookingList> {
    const before = decodeCursor(cursor);
    const rows = await this.db.booking.findMany({
      where: before !== undefined ? { AND: [where, { id: { lt: before } }] } : where,
      orderBy: { id: "desc" },
      take: limit + 1,
    });
    const items = rows.slice(0, limit);
    return {
      items: items.map((b) => ({
        ...toBookingSummary(b),
        commission: toMoney(b.commissionMinor, b.currency),
      })),
      nextCursor:
        rows.length > limit && items.length ? encodeCursor(items[items.length - 1]!.id) : null,
    };
  }

  // ─── Administration (partner:manage) ──────────────────────────────────────

  async list(): Promise<PartnerView[]> {
    const rows = await this.db.partner.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      include: PARTNER_INCLUDE,
    });
    return rows.map(toView);
  }

  async create(input: CreatePartner, actor: AuthContext, ip: string | null): Promise<PartnerView> {
    const passwordHash = await this.passwords.hash(input.member.password);
    try {
      const id = await this.db.$transaction(async (tx) => {
        const partner = await tx.partner.create({
          data: {
            publicId: newPublicId(),
            kind: input.kind,
            name: input.name,
            email: input.email,
            phone: input.phone,
            commissionBps: input.kind === "AGENT" ? input.commissionBps : 0,
          },
        });
        await tx.user.create({
          data: {
            publicId: newPublicId(),
            email: input.member.email,
            fullName: input.member.fullName,
            passwordHash,
            kind: "PARTNER",
            partnerId: partner.id,
          },
        });
        await this.record(tx, actor, ip, "partner.created", partner.publicId, {
          kind: input.kind,
          name: input.name,
          member: input.member.email,
        });
        return partner.publicId;
      });
      return this.one(id);
    } catch (error) {
      throw emailTaken(error);
    }
  }

  async update(
    publicId: string,
    input: UpdatePartner,
    actor: AuthContext,
    ip: string | null,
  ): Promise<PartnerView> {
    await this.db.$transaction(async (tx) => {
      const p = await tx.partner.findUnique({ where: { publicId } });
      if (!p) throw new ProblemException(404, "partner-not-found", "Partner not found");
      await tx.partner.update({
        where: { id: p.id },
        data: { ...input, commissionBps: p.kind === "AGENT" ? input.commissionBps : 0 },
      });
      if (input.status === "SUSPENDED") {
        // Suspension takes effect immediately for every partner user.
        await tx.session.updateMany({
          where: { user: { partnerId: p.id }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.record(tx, actor, ip, "partner.updated", publicId, {
        status: input.status,
        commissionBps: input.commissionBps,
      });
    });
    return this.one(publicId);
  }

  async addMember(
    publicId: string,
    input: PartnerMemberInput,
    actor: AuthContext,
    ip: string | null,
  ): Promise<PartnerView> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      await this.db.$transaction(async (tx) => {
        const p = await tx.partner.findUnique({ where: { publicId } });
        if (!p) throw new ProblemException(404, "partner-not-found", "Partner not found");
        await tx.user.create({
          data: {
            publicId: newPublicId(),
            email: input.email,
            fullName: input.fullName,
            passwordHash,
            kind: "PARTNER",
            partnerId: p.id,
          },
        });
        await this.record(tx, actor, ip, "partner.member_added", publicId, { email: input.email });
      });
    } catch (error) {
      throw emailTaken(error);
    }
    return this.one(publicId);
  }

  async setMemberStatus(
    publicId: string,
    memberId: string,
    status: "ACTIVE" | "DISABLED",
    actor: AuthContext,
    ip: string | null,
  ) {
    await this.db.$transaction(async (tx) => {
      const member = await tx.user.findFirst({
        where: { publicId: memberId, kind: "PARTNER", partner: { publicId } },
      });
      if (!member) throw new ProblemException(404, "member-not-found", "Partner user not found");
      await tx.user.update({ where: { id: member.id }, data: { status } });
      if (status === "DISABLED") {
        await tx.session.updateMany({
          where: { userId: member.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.record(tx, actor, ip, "partner.member_status", publicId, {
        member: member.email,
        status,
      });
    });
    return this.one(publicId);
  }

  /** Assigns hotels and tours to a supplier (replacing its current set). */
  async setOwnership(
    publicId: string,
    input: PartnerOwnership,
    actor: AuthContext,
    ip: string | null,
  ): Promise<PartnerView> {
    await this.db.$transaction(async (tx) => {
      const p = await tx.partner.findUnique({ where: { publicId } });
      if (!p) throw new ProblemException(404, "partner-not-found", "Partner not found");
      if (p.kind !== "SUPPLIER")
        throw new ProblemException(422, "not-a-supplier", "Only suppliers manage inventory");
      await tx.hotel.updateMany({
        where: { partnerId: p.id, slug: { notIn: input.hotelSlugs } },
        data: { partnerId: null },
      });
      await tx.tour.updateMany({
        where: { partnerId: p.id, slug: { notIn: input.tourSlugs } },
        data: { partnerId: null },
      });
      const h = await tx.hotel.updateMany({
        where: { slug: { in: input.hotelSlugs } },
        data: { partnerId: p.id },
      });
      const t = await tx.tour.updateMany({
        where: { slug: { in: input.tourSlugs } },
        data: { partnerId: p.id },
      });
      if (h.count !== input.hotelSlugs.length || t.count !== input.tourSlugs.length) {
        throw new ProblemException(422, "unknown-product", "Unknown hotel or tour in the list");
      }
      await this.record(tx, actor, ip, "partner.ownership_set", publicId, {
        hotels: input.hotelSlugs,
        tours: input.tourSlugs,
      });
    });
    return this.one(publicId);
  }

  private async one(publicId: string): Promise<PartnerView> {
    const p = await this.db.partner.findUnique({ where: { publicId }, include: PARTNER_INCLUDE });
    if (!p) throw new ProblemException(404, "partner-not-found", "Partner not found");
    return toView(p);
  }

  private record(
    tx: Prisma.TransactionClient,
    actor: AuthContext,
    ip: string | null,
    action: string,
    targetId: string,
    metadata: Prisma.InputJsonValue,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType: "partner",
        targetId,
        ipAddress: ip,
        metadata,
      },
      tx,
    );
  }
}

function toView(p: PartnerRow): PartnerView {
  return {
    id: p.publicId,
    kind: p.kind,
    name: p.name,
    email: p.email,
    phone: p.phone,
    commissionBps: p.commissionBps,
    status: p.status,
    members: p.members.map((m) => ({
      id: m.publicId,
      fullName: m.fullName,
      email: m.email,
      status: m.status,
    })),
    hotels: p.hotels,
    tours: p.tours,
    createdAt: p.createdAt.toISOString(),
  };
}

function emailTaken(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ProblemException(
      409,
      "email-taken",
      "Email already registered",
      "Use a different email for this partner user.",
    );
  }
  return error;
}
