import { z } from "zod";
import { BdPhoneSchema, EmailSchema } from "./auth";
import { InstantSchema, MoneySchema, PublicIdSchema, SlugSchema, nullableText } from "./common";
import { HeroRefSchema, MediaKeySchema } from "./media";

/**
 * Offers, ads, orders and gift cards (ADR-0032). Money is integer paisa;
 * every amount is recomputed on the server.
 */

const Line = (min: number, max: number) => z.string().trim().min(min).max(max);
const PublishStatus = z.enum(["DRAFT", "PUBLISHED", "SUSPENDED"]);
const Taka = z.number().int().positive().max(10_000_000_00);

// ─── Offers ──────────────────────────────────────────────────────────────────

export const OfferInputSchema = z
  .object({
    titleEn: Line(3, 160),
    titleBn: Line(3, 160),
    summaryEn: Line(10, 300),
    summaryBn: Line(10, 300),
    detailsEn: Line(10, 5000),
    detailsBn: Line(10, 5000),
    /** Price per unit in paisa. */
    priceMinor: Taka,
    /** Optional "was" price in paisa, higher than the price. */
    originalPriceMinor: Taka.nullable(),
    heroMedia: MediaKeySchema.nullable(),
    validUntil: InstantSchema.nullable(),
    /** Units for sale; null = unlimited. */
    stock: z.number().int().min(0).max(100_000).nullable(),
    status: PublishStatus,
    sortOrder: z.number().int().min(0).max(9999),
  })
  .refine((o) => o.originalPriceMinor === null || o.originalPriceMinor > o.priceMinor, {
    message: "The original price must be higher than the offer price",
    path: ["originalPriceMinor"],
  });
export type OfferInput = z.infer<typeof OfferInputSchema>;
export const CreateOfferSchema = OfferInputSchema.and(z.object({ slug: SlugSchema }));

const OfferCore = z.object({
  id: PublicIdSchema,
  slug: SlugSchema,
  titleEn: z.string(),
  titleBn: z.string(),
  summaryEn: z.string(),
  summaryBn: z.string(),
  price: MoneySchema,
  originalPrice: MoneySchema.nullable(),
  hero: HeroRefSchema.nullable(),
  validUntil: InstantSchema.nullable(),
  /** Units left; null = unlimited. */
  remaining: z.number().int().nullable(),
});

export const PublicOfferSchema = OfferCore.extend({
  detailsEn: z.string(),
  detailsBn: z.string(),
  /** False when sold out or expired. */
  available: z.boolean(),
});
export const PublicOfferListSchema = z.object({
  items: z.array(OfferCore.extend({ available: z.boolean() })),
});

export const AdminOfferSchema = PublicOfferSchema.extend({
  status: PublishStatus,
  stock: z.number().int().nullable(),
  sold: z.number().int(),
  sortOrder: z.number().int(),
  updatedAt: InstantSchema,
});
export const AdminOfferListSchema = z.object({ items: z.array(AdminOfferSchema) });
export const AdminOfferResultSchema = z.object({ offer: AdminOfferSchema });

// ─── Ads ─────────────────────────────────────────────────────────────────────

export const AdPlacementSchema = z.enum(["HOME_TOP", "HOME_MIDDLE", "OFFERS_TOP"]);
export const AdInputSchema = z
  .object({
    titleEn: Line(2, 120),
    titleBn: Line(2, 120),
    textEn: z.string().trim().max(240),
    textBn: z.string().trim().max(240),
    media: MediaKeySchema,
    linkHref: z.union([z.string().regex(/^(\/[\w\-./?=&#%]*|https:\/\/\S+)$/), z.literal("")]),
    placement: AdPlacementSchema,
    startsAt: InstantSchema.nullable(),
    endsAt: InstantSchema.nullable(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(9999),
  })
  .refine((a) => !a.startsAt || !a.endsAt || a.endsAt > a.startsAt, {
    message: "The end must be after the start",
    path: ["endsAt"],
  });
export type AdInput = z.infer<typeof AdInputSchema>;

export const PublicAdSchema = z.object({
  id: PublicIdSchema,
  titleEn: z.string(),
  titleBn: z.string(),
  textEn: z.string(),
  textBn: z.string(),
  image: HeroRefSchema,
  linkHref: z.string(),
  placement: AdPlacementSchema,
});
export const PublicAdListSchema = z.object({ items: z.array(PublicAdSchema) });
export const AdminAdSchema = PublicAdSchema.extend({
  startsAt: InstantSchema.nullable(),
  endsAt: InstantSchema.nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  /** Showing on the website right now (active and within its dates). */
  live: z.boolean(),
});
export const AdminAdListSchema = z.object({ items: z.array(AdminAdSchema) });
export const AdminAdResultSchema = z.object({ ad: AdminAdSchema });
export const AdListQuerySchema = z.object({ placement: AdPlacementSchema });

// ─── Orders ──────────────────────────────────────────────────────────────────

const Buyer = z.object({
  name: Line(2, 120),
  email: EmailSchema,
  phone: BdPhoneSchema,
});

export const CreateOfferOrderSchema = z.object({
  offerId: PublicIdSchema,
  quantity: z.number().int().min(1).max(20),
  buyer: Buyer,
  note: z.string().trim().max(500).optional(),
  /** The total the customer was shown; a mismatch answers 409 price-changed. */
  expectedTotal: MoneySchema,
});

/** Gift card amounts, in whole taka; the minimum keeps fees reasonable. */
export const GIFT_CARD_MIN_TAKA = 500;
export const GIFT_CARD_MAX_TAKA = 100_000;
export const CreateGiftCardOrderSchema = z
  .object({
    /** Amount in whole taka (no paisa on gift cards). */
    amountTaka: z.number().int().min(GIFT_CARD_MIN_TAKA).max(GIFT_CARD_MAX_TAKA),
    buyer: Buyer,
    forSelf: z.boolean(),
    recipientName: z.string().trim().max(120).optional(),
    recipientEmail: EmailSchema.optional(),
    message: z.string().trim().max(300).optional(),
  })
  .refine(
    (g) => g.forSelf || (g.recipientName && g.recipientName.length >= 2 && g.recipientEmail),
    {
      message: "Enter the recipient's name and email",
      path: ["recipientEmail"],
    },
  );

export const OrderStatusSchema = z.enum(["PENDING_PAYMENT", "PAID", "CANCELLED", "EXPIRED"]);
export const OrderViewSchema = z.object({
  id: PublicIdSchema,
  reference: z.string(),
  kind: z.enum(["OFFER", "GIFT_CARD"]),
  status: OrderStatusSchema,
  title: z.string(),
  titleBn: z.string(),
  quantity: z.number().int(),
  total: MoneySchema,
  buyer: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
  recipient: z.object({ name: z.string(), email: z.string() }).nullable(),
  giftMessage: nullableText(300),
  note: nullableText(500),
  expiresAt: InstantSchema,
  paidAt: InstantSchema.nullable(),
  paidOffline: nullableText(200),
  /** True when online payment is enabled and this order can be paid now. */
  canPay: z.boolean(),
  /** Gift card orders once paid: masked card (the code goes only by email). */
  giftCard: z
    .object({
      last4: z.string(),
      balance: MoneySchema,
      expiresAt: InstantSchema,
      status: z.string(),
    })
    .nullable(),
  createdAt: InstantSchema,
});
export type OrderView = z.infer<typeof OrderViewSchema>;
export const OrderListSchema = z.object({
  items: z.array(OrderViewSchema),
  nextCursor: nullableText(200),
});

export const AdminOrderSchema = OrderViewSchema.extend({
  customer: z.object({ id: PublicIdSchema, fullName: z.string(), email: z.string() }),
});
export const AdminOrderListSchema = z.object({
  items: z.array(AdminOrderSchema),
  nextCursor: nullableText(200),
});
export const AdminOrderListQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
  kind: z.enum(["OFFER", "GIFT_CARD"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const MarkOrderPaidSchema = z.object({
  /** How it was paid, e.g. "bKash TrxID 8N7K2…" — kept on the order and in the audit log. */
  reference: Line(3, 200),
});
export const CancelOrderSchema = z.object({ reason: Line(3, 300) });

// ─── Gift cards ──────────────────────────────────────────────────────────────

/** Codes are 16 letters/digits in groups of four; case and spaces do not matter. */
export const GiftCardCodeSchema = z
  .string()
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .pipe(z.string().regex(/^[A-HJ-NP-Z2-9]{16}$/, "Check the gift card code"));

export const GiftCardBalanceQuerySchema = z.object({ code: GiftCardCodeSchema });
export const GiftCardBalanceSchema = z.object({
  last4: z.string(),
  balance: MoneySchema,
  expiresAt: InstantSchema,
  usable: z.boolean(),
});

export const AdminGiftCardSchema = z.object({
  id: PublicIdSchema,
  last4: z.string(),
  initial: MoneySchema,
  balance: MoneySchema,
  status: z.enum(["ACTIVE", "VOID"]),
  expiresAt: InstantSchema,
  recipientName: z.string(),
  recipientEmail: z.string(),
  orderReference: nullableText(12),
  createdAt: InstantSchema,
  txns: z.array(
    z.object({
      kind: z.enum(["ISSUE", "REDEEM", "RELEASE", "VOID", "REFUND"]),
      /** Absolute amount: ISSUE, RELEASE and REFUND add to the balance, REDEEM and VOID take from it. */
      amount: MoneySchema,
      balanceAfter: MoneySchema,
      bookingReference: nullableText(12),
      note: nullableText(200),
      at: InstantSchema,
    }),
  ),
});
export const AdminGiftCardListSchema = z.object({
  items: z.array(AdminGiftCardSchema),
  nextCursor: nullableText(200),
});
export const AdminGiftCardListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const IssueGiftCardSchema = z.object({
  amountTaka: z.number().int().min(100).max(GIFT_CARD_MAX_TAKA),
  recipientName: Line(2, 120),
  recipientEmail: EmailSchema,
  message: z.string().trim().max(300).optional(),
  /** Why it is issued without payment (compensation, promotion…). */
  reason: Line(3, 200),
});
export const VoidGiftCardSchema = z.object({ reason: Line(3, 200) });
export const AdminGiftCardResultSchema = z.object({ giftCard: AdminGiftCardSchema });

// ─── Gift card redemption (ADR-0034) ─────────────────────────────────────────

export const ApplyGiftCardSchema = z.object({ code: GiftCardCodeSchema });
export const ApplyGiftCardResultSchema = z.object({
  /** Amount taken from the card for this booking. */
  applied: MoneySchema,
  /** Left to pay online; zero means the booking is confirmed. */
  amountDue: MoneySchema,
  /** Remaining balance on the card. */
  cardBalance: MoneySchema,
  bookingStatus: z.string(),
});
