import { Inject, Injectable } from "@nestjs/common";
import type {
  ContentPage,
  ContentPageInput,
  CreatePromotion,
  PromotionInput,
  PromotionView,
  ReportQuery,
  SalesReport,
} from "@pegah/contracts";
import { BOOKING_STATUSES } from "@pegah/contracts";
import { Prisma, type BookingStatus, type Promotion } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { newPublicId } from "../common/ids";
import { toMoney } from "../common/money";
import { ProblemException } from "../common/problem";
import { addDays, formatCalendarDate, parseCalendarDate } from "../common/time";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { REDEEMING } from "../promotions/promotion.service";

const CONFIRMED: BookingStatus[] = ["CONFIRMED", "COMPLETED"];
const DHAKA_OFFSET_MS = 6 * 3_600_000;
const MAX_REPORT_DAYS = 366;

/**
 * Phase 6 growth tools (ADR-0025): promotions administration, sales reports
 * (JSON + CSV) and simple content pages. All money is summed as BIGINT; only
 * BDT is reported until multi-currency reporting exists.
 */
@Injectable()
export class GrowthService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ─── Promotions ───────────────────────────────────────────────────────────

  async promotions(): Promise<PromotionView[]> {
    const rows = await this.db.promotion.findMany({
      orderBy: [{ status: "asc" }, { endsAt: "desc" }],
    });
    const usage = await this.db.booking.groupBy({
      by: ["promotionId"],
      where: { promotionId: { not: null }, status: { in: REDEEMING } },
      _count: { _all: true },
      _sum: { discountMinor: true },
    });
    const byId = new Map(usage.map((u) => [u.promotionId!, u]));
    return rows.map((p) =>
      toView(p, byId.get(p.id)?._count._all ?? 0, byId.get(p.id)?._sum.discountMinor ?? 0n),
    );
  }

  async createPromotion(
    input: CreatePromotion,
    actor: AuthContext,
    ip: string | null,
  ): Promise<PromotionView> {
    try {
      const p = await this.db.$transaction(async (tx) => {
        const row = await tx.promotion.create({
          data: { ...promotionData(input.promotion), publicId: newPublicId(), code: input.code },
        });
        await this.audit.record(
          {
            actorType: "STAFF",
            actorUserId: actor.user.id,
            action: "promotion.created",
            targetType: "promotion",
            targetId: row.code,
            ipAddress: ip,
            metadata: { name: row.name },
          },
          tx,
        );
        return row;
      });
      return toView(p, 0, 0n);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(
          409,
          "code-taken",
          "Code already exists",
          "Choose a different code.",
        );
      }
      throw error;
    }
  }

  async updatePromotion(
    id: string,
    input: PromotionInput,
    actor: AuthContext,
    ip: string | null,
  ): Promise<PromotionView> {
    await this.db.$transaction(async (tx) => {
      const found = await tx.promotion.findUnique({ where: { publicId: id } });
      if (!found) throw new ProblemException(404, "promotion-not-found", "Promotion not found");
      await tx.promotion.update({ where: { id: found.id }, data: promotionData(input) });
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "promotion.updated",
          targetType: "promotion",
          targetId: found.code,
          ipAddress: ip,
          metadata: { status: input.status },
        },
        tx,
      );
    });
    const view = (await this.promotions()).find((p) => p.id === id);
    if (!view) throw new ProblemException(404, "promotion-not-found", "Promotion not found");
    return view;
  }

  // ─── Reports ──────────────────────────────────────────────────────────────

  /** Bookings created in [from, to] (Dhaka calendar days). */
  async sales(q: ReportQuery): Promise<SalesReport> {
    const { from, to, start, end, days } = range(q);
    const bookings = await this.db.booking.findMany({
      where: { createdAt: { gte: start, lt: end }, currency: "BDT" },
      select: {
        createdAt: true,
        status: true,
        totalMinor: true,
        discountMinor: true,
        productType: true,
        productName: true,
      },
    });
    const refunds = await this.db.refund.aggregate({
      where: { status: "PAID", paidAt: { gte: start, lt: end }, currency: "BDT" },
      _sum: { amountMinor: true },
    });
    let confirmedValue = 0n;
    let discounts = 0n;
    let confirmedBookings = 0;
    const statuses = new Map<string, number>();
    const products = new Map<
      string,
      { type: "HOTEL" | "TOUR"; name: string; bookings: number; value: bigint }
    >();
    const byDay = Array.from({ length: days }, (_, i) => ({
      date: formatCalendarDate(addDays(from, i)),
      bookings: 0,
      value: 0n,
    }));
    for (const b of bookings) {
      statuses.set(b.status, (statuses.get(b.status) ?? 0) + 1);
      const key = `${b.productType}:${b.productName}`;
      const prod = products.get(key) ?? {
        type: b.productType,
        name: b.productName,
        bookings: 0,
        value: 0n,
      };
      prod.bookings++;
      const day =
        byDay[Math.floor((b.createdAt.getTime() + DHAKA_OFFSET_MS - from.getTime()) / 86_400_000)];
      if (day) day.bookings++;
      if (CONFIRMED.includes(b.status)) {
        confirmedBookings++;
        confirmedValue += b.totalMinor;
        discounts += b.discountMinor;
        prod.value += b.totalMinor;
        if (day) day.value += b.totalMinor;
      }
      products.set(key, prod);
    }
    const refunded = refunds._sum.amountMinor ?? 0n;
    const net = confirmedValue - refunded;
    return {
      from: formatCalendarDate(from),
      to: formatCalendarDate(to),
      totals: {
        bookings: bookings.length,
        confirmedBookings,
        confirmedValue: toMoney(confirmedValue, "BDT"),
        discounts: toMoney(discounts, "BDT"),
        refunded: toMoney(refunded, "BDT"),
        netRevenue: toMoney(net > 0n ? net : 0n, "BDT"),
      },
      byStatus: BOOKING_STATUSES.filter((s) => statuses.has(s)).map((s) => ({
        status: s,
        count: statuses.get(s)!,
      })),
      byProduct: [...products.values()]
        .sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : b.bookings - a.bookings))
        .map((p) => ({
          type: p.type,
          name: p.name,
          bookings: p.bookings,
          confirmedValue: toMoney(p.value, "BDT"),
        })),
      byDay: byDay.map((d) => ({
        date: d.date,
        bookings: d.bookings,
        confirmedValue: toMoney(d.value, "BDT"),
      })),
    };
  }

  /** CSV of every booking created in the range (one row per booking). */
  async bookingsCsv(q: ReportQuery): Promise<string> {
    const { start, end } = range(q);
    const rows = await this.db.booking.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { id: "asc" },
      include: { promotion: { select: { code: true } } },
    });
    const header = [
      "reference",
      "created_at_utc",
      "status",
      "product_type",
      "product_name",
      "start_date",
      "end_date",
      "guests",
      "currency",
      "base",
      "discount",
      "service_charge",
      "vat",
      "total",
      "promo_code",
      "contact_name",
      "contact_email",
    ];
    const lines = rows.map((b) =>
      [
        b.reference,
        b.createdAt.toISOString(),
        b.status,
        b.productType,
        b.productName,
        formatCalendarDate(b.startDate),
        b.endDate ? formatCalendarDate(b.endDate) : "",
        b.guestCount,
        b.currency,
        decimal(b.baseMinor),
        decimal(b.discountMinor),
        decimal(b.serviceChargeMinor),
        decimal(b.vatMinor),
        decimal(b.totalMinor),
        b.promotion?.code ?? "",
        b.contactName,
        b.contactEmail,
      ]
        .map(csvCell)
        .join(","),
    );
    // BOM so spreadsheet apps open the UTF-8 (Bangla names, ৳) correctly.
    return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
  }

  // ─── Content pages ────────────────────────────────────────────────────────

  async pages() {
    const rows = await this.db.contentPage.findMany({ orderBy: { slug: "asc" } });
    return rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async page(slug: string): Promise<ContentPage> {
    const p = await this.db.contentPage.findUnique({ where: { slug } });
    if (!p) throw new ProblemException(404, "page-not-found", "Page not found");
    return {
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      body: p.body,
      status: p.status,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async publicPage(slug: string) {
    const p = await this.db.contentPage.findFirst({ where: { slug, status: "PUBLISHED" } });
    if (!p) throw new ProblemException(404, "page-not-found", "Page not found");
    return {
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      body: p.body,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async savePage(
    slug: string,
    input: ContentPageInput,
    create: boolean,
    actor: AuthContext,
    ip: string | null,
  ) {
    try {
      await this.db.$transaction(async (tx) => {
        if (create) {
          await tx.contentPage.create({ data: { ...input, slug, updatedById: actor.user.id } });
        } else {
          const updated = await tx.contentPage.updateMany({
            where: { slug },
            data: { ...input, updatedById: actor.user.id },
          });
          if (updated.count !== 1)
            throw new ProblemException(404, "page-not-found", "Page not found");
        }
        await this.audit.record(
          {
            actorType: "STAFF",
            actorUserId: actor.user.id,
            action: create ? "content.page_created" : "content.page_updated",
            targetType: "page",
            targetId: slug,
            ipAddress: ip,
            metadata: { status: input.status },
          },
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(
          409,
          "slug-taken",
          "Address already in use",
          "Choose a different URL slug.",
        );
      }
      throw error;
    }
    return this.page(slug);
  }
}

function range(q: ReportQuery) {
  const from = parseCalendarDate(q.from);
  const to = parseCalendarDate(q.to);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > MAX_REPORT_DAYS) {
    throw new ProblemException(
      422,
      "range-too-large",
      "Range too large",
      `At most ${MAX_REPORT_DAYS} days per report.`,
    );
  }
  // Dhaka midnight boundaries as UTC instants.
  return {
    from,
    to,
    days,
    start: new Date(from.getTime() - DHAKA_OFFSET_MS),
    end: new Date(addDays(to, 1).getTime() - DHAKA_OFFSET_MS),
  };
}

function promotionData(p: PromotionInput) {
  return {
    name: p.name,
    kind: p.kind,
    percentBps: p.kind === "PERCENT" ? p.percentBps : null,
    amountMinor: p.kind === "FIXED" && p.amount ? BigInt(p.amount.amountMinor) : null,
    currency: p.minSpend.currency,
    minSpendMinor: BigInt(p.minSpend.amountMinor),
    maxDiscountMinor: p.maxDiscount ? BigInt(p.maxDiscount.amountMinor) : null,
    scope: p.scope,
    startsAt: new Date(p.startsAt),
    endsAt: new Date(p.endsAt),
    maxRedemptions: p.maxRedemptions,
    perCustomerLimit: p.perCustomerLimit,
    status: p.status,
  };
}

function toView(p: Promotion, redemptions: number, discountGiven: bigint): PromotionView {
  return {
    id: p.publicId,
    code: p.code,
    name: p.name,
    kind: p.kind,
    percentBps: p.percentBps,
    amount: p.amountMinor !== null ? toMoney(p.amountMinor, p.currency) : null,
    minSpend: toMoney(p.minSpendMinor, p.currency),
    maxDiscount: p.maxDiscountMinor !== null ? toMoney(p.maxDiscountMinor, p.currency) : null,
    scope: p.scope,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    maxRedemptions: p.maxRedemptions,
    perCustomerLimit: p.perCustomerLimit,
    status: p.status,
    redemptions,
    discountGiven: toMoney(discountGiven, p.currency),
  };
}

const decimal = (minor: bigint) => `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;

/** CSV cell with quoting, and a leading quote on formula-like text (CSV injection). */
function csvCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
