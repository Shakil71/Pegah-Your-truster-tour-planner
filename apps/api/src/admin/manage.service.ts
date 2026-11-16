import { Inject, Injectable } from "@nestjs/common";
import type { ManagedKind, Permission } from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import type { Tx } from "../booking/inventory";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

/** Who may delete or hide each kind: the same permission that edits it. */
const PERMISSION: Record<ManagedKind, Permission> = {
  destination: "catalog:manage",
  hotel: "catalog:manage",
  room: "catalog:manage",
  tour: "catalog:manage",
  departure: "inventory:manage",
  offer: "promotion:manage",
  promotion: "promotion:manage",
  page: "content:manage",
  visa: "catalog:manage",
  ad: "promotion:manage",
  "gift-card-design": "promotion:manage",
  "contact-message": "service:manage",
};

const notFound = () => new ProblemException(404, "item-not-found", "Not found");

const inUse = (what: string) =>
  new ProblemException(
    409,
    "item-in-use",
    "Cannot delete",
    `${what} Records that customers and accounts rely on are kept, so it cannot be deleted. Hide it instead: it disappears from the website.`,
  );

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * Delete or show/hide any listing from the console (catalog, offers, ads,
 * pages, visas, messages). Everything happens in one transaction with an
 * audit entry. Items that bookings, orders or requests point at are never
 * deleted (money and history must stay traceable); staff hide them instead.
 */
@Injectable()
export class ManageService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private allow(kind: ManagedKind, actor: AuthContext) {
    if (!actor.permissions.includes(PERMISSION[kind])) {
      throw new ProblemException(
        403,
        "forbidden",
        "Not allowed",
        `You need the ${PERMISSION[kind]} permission for this.`,
      );
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(kind: ManagedKind, key: string, actor: AuthContext, ip: string | null) {
    this.allow(kind, actor);
    await this.db.$transaction(async (tx) => {
      const label = await this.deleteOne(tx, kind, key);
      await this.record(tx, actor, ip, `${kind}.deleted`, kind, key, { label });
    });
  }

  private async deleteOne(tx: Tx, kind: ManagedKind, key: string): Promise<string> {
    switch (kind) {
      case "destination": {
        const d = await tx.destination.findUnique({
          where: { slug: key },
          select: { id: true, name: true, _count: { select: { hotels: true, tours: true } } },
        });
        if (!d) throw notFound();
        if (d._count.hotels + d._count.tours > 0) {
          throw new ProblemException(
            409,
            "item-in-use",
            "Cannot delete",
            `${d.name} still has ${plural(d._count.hotels, "hotel")} and ${plural(d._count.tours, "tour")}. Delete those first, or hide the destination instead.`,
          );
        }
        await tx.destination.delete({ where: { id: d.id } });
        return d.name;
      }
      case "hotel": {
        const h = await tx.hotel.findUnique({
          where: { slug: key },
          select: { id: true, name: true, rooms: { select: { id: true } } },
        });
        if (!h) throw notFound();
        const roomIds = h.rooms.map((r) => r.id);
        await this.assertRoomsUnused(tx, roomIds, `${h.name} has bookings.`);
        await this.deleteRooms(tx, roomIds);
        await tx.hotelMedia.deleteMany({ where: { hotelId: h.id } });
        await tx.hotelAmenity.deleteMany({ where: { hotelId: h.id } });
        await tx.hotel.delete({ where: { id: h.id } });
        return h.name;
      }
      case "room": {
        const r = await tx.hotelRoom.findUnique({
          where: { publicId: key },
          select: { id: true, name: true },
        });
        if (!r) throw notFound();
        await this.assertRoomsUnused(tx, [r.id], `The room "${r.name}" has bookings.`);
        await this.deleteRooms(tx, [r.id]);
        return r.name;
      }
      case "tour": {
        const t = await tx.tour.findUnique({
          where: { slug: key },
          select: { id: true, title: true, schedules: { select: { id: true } } },
        });
        if (!t) throw notFound();
        const ids = t.schedules.map((s) => s.id);
        await this.assertDeparturesUnused(tx, ids, `${t.title} has bookings.`);
        await tx.tourSchedule.deleteMany({ where: { id: { in: ids } } });
        await tx.tourMedia.deleteMany({ where: { tourId: t.id } });
        await tx.tourAmenity.deleteMany({ where: { tourId: t.id } });
        await tx.tour.delete({ where: { id: t.id } });
        return t.title;
      }
      case "departure": {
        const s = await tx.tourSchedule.findUnique({
          where: { publicId: key },
          select: { id: true, departsAt: true },
        });
        if (!s) throw notFound();
        await this.assertDeparturesUnused(tx, [s.id], "This departure has bookings.");
        await tx.tourSchedule.delete({ where: { id: s.id } });
        return s.departsAt.toISOString();
      }
      case "offer": {
        const o = await tx.offer.findUnique({
          where: { publicId: key },
          select: { id: true, titleEn: true, _count: { select: { orders: true } } },
        });
        if (!o) throw notFound();
        if (o._count.orders > 0)
          throw inUse(`${o.titleEn} has ${plural(o._count.orders, "order")}.`);
        await tx.offerMedia.deleteMany({ where: { offerId: o.id } });
        await tx.offer.delete({ where: { id: o.id } });
        return o.titleEn;
      }
      case "promotion": {
        const p = await tx.promotion.findUnique({
          where: { publicId: key },
          select: { id: true, code: true, _count: { select: { bookings: true } } },
        });
        if (!p) throw notFound();
        if (p._count.bookings > 0) {
          throw inUse(`The code ${p.code} was used on ${plural(p._count.bookings, "booking")}.`);
        }
        await tx.promotion.delete({ where: { id: p.id } });
        return p.code;
      }
      case "page": {
        const p = await tx.contentPage.findUnique({
          where: { slug: key },
          select: { id: true, slug: true },
        });
        if (!p) throw notFound();
        await tx.contentPage.delete({ where: { id: p.id } });
        return p.slug;
      }
      case "visa": {
        const v = await tx.visaProduct.findUnique({
          where: { slug: key },
          select: { id: true, slug: true, _count: { select: { requests: true } } },
        });
        if (!v) throw notFound();
        if (v._count.requests > 0) {
          throw inUse(`This visa has ${plural(v._count.requests, "customer request")}.`);
        }
        await tx.visaProduct.delete({ where: { id: v.id } });
        return v.slug;
      }
      case "ad": {
        const a = await tx.ad.findUnique({
          where: { publicId: key },
          select: { id: true, titleEn: true },
        });
        if (!a) throw notFound();
        await tx.ad.delete({ where: { id: a.id } });
        return a.titleEn;
      }
      case "gift-card-design": {
        const g = await tx.giftCardDesign.findUnique({
          where: { publicId: key },
          select: { id: true, nameEn: true },
        });
        if (!g) throw notFound();
        await tx.giftCardDesign.delete({ where: { id: g.id } });
        return g.nameEn;
      }
      case "contact-message": {
        const m = await tx.contactMessage.findUnique({
          where: { publicId: key },
          select: { id: true, reference: true },
        });
        if (!m) throw notFound();
        await tx.contactMessage.delete({ where: { id: m.id } });
        return m.reference;
      }
    }
  }

  private async assertRoomsUnused(tx: Tx, roomIds: bigint[], what: string) {
    if (roomIds.length === 0) return;
    const [items, holds] = await Promise.all([
      tx.bookingItem.count({ where: { hotelRoomId: { in: roomIds } } }),
      tx.inventoryHold.count({ where: { hotelRoomId: { in: roomIds } } }),
    ]);
    if (items + holds > 0) throw inUse(what);
  }

  private async assertDeparturesUnused(tx: Tx, ids: bigint[], what: string) {
    if (ids.length === 0) return;
    const [items, holds] = await Promise.all([
      tx.bookingItem.count({ where: { tourScheduleId: { in: ids } } }),
      tx.inventoryHold.count({ where: { tourScheduleId: { in: ids } } }),
    ]);
    if (items + holds > 0) throw inUse(what);
  }

  private async deleteRooms(tx: Tx, roomIds: bigint[]) {
    if (roomIds.length === 0) return;
    const where = { roomId: { in: roomIds } };
    await tx.roomMedia.deleteMany({ where });
    await tx.roomAmenity.deleteMany({ where });
    await tx.roomInventory.deleteMany({ where });
    await tx.roomRate.deleteMany({ where });
    await tx.hotelRoom.deleteMany({ where: { id: { in: roomIds } } });
  }

  // ── Show / hide ───────────────────────────────────────────────────────────

  async setVisible(
    kind: ManagedKind,
    key: string,
    visible: boolean,
    actor: AuthContext,
    ip: string | null,
  ): Promise<{ visible: boolean }> {
    this.allow(kind, actor);
    // Hidden listings go back to DRAFT ("Draft (hidden)" in the forms).
    const status = visible ? ("PUBLISHED" as const) : ("DRAFT" as const);
    await this.db.$transaction(async (tx) => {
      const n = await this.applyVisible(tx, kind, key, visible, status);
      if (n === 0) throw notFound();
      await this.record(tx, actor, ip, `${kind}.${visible ? "shown" : "hidden"}`, kind, key, {});
    });
    return { visible };
  }

  private async applyVisible(
    tx: Tx,
    kind: ManagedKind,
    key: string,
    visible: boolean,
    status: "PUBLISHED" | "DRAFT",
  ): Promise<number> {
    switch (kind) {
      case "destination":
        return (await tx.destination.updateMany({ where: { slug: key }, data: { status } })).count;
      case "hotel":
        return (await tx.hotel.updateMany({ where: { slug: key }, data: { status } })).count;
      case "tour":
        return (await tx.tour.updateMany({ where: { slug: key }, data: { status } })).count;
      case "offer":
        return (await tx.offer.updateMany({ where: { publicId: key }, data: { status } })).count;
      case "page":
        return (await tx.contentPage.updateMany({ where: { slug: key }, data: { status } })).count;
      case "visa":
        return (await tx.visaProduct.updateMany({ where: { slug: key }, data: { status } })).count;
      case "room":
        return (
          await tx.hotelRoom.updateMany({ where: { publicId: key }, data: { isActive: visible } })
        ).count;
      case "promotion":
        return (
          await tx.promotion.updateMany({
            where: { publicId: key },
            data: { status: visible ? "ACTIVE" : "PAUSED" },
          })
        ).count;
      case "ad":
        return (await tx.ad.updateMany({ where: { publicId: key }, data: { active: visible } }))
          .count;
      case "gift-card-design":
        return (
          await tx.giftCardDesign.updateMany({
            where: { publicId: key },
            data: { active: visible },
          })
        ).count;
      default:
        throw new ProblemException(
          422,
          "no-visibility",
          "Cannot be hidden",
          "This item can be deleted but not hidden.",
        );
    }
  }

  private record(
    tx: Tx,
    actor: AuthContext,
    ip: string | null,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
  ) {
    return this.audit.record(
      {
        actorType: "STAFF",
        actorUserId: actor.user.id,
        action,
        targetType,
        targetId,
        ipAddress: ip,
        metadata: metadata as Prisma.InputJsonValue,
      },
      tx,
    );
  }
}
