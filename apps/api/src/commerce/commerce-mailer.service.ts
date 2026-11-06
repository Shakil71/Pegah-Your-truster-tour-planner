import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { taka } from "../email/taka";
import {
  emailLocale,
  esc,
  hello,
  layout,
  type EmailLocale,
  type RenderedEmail,
} from "../email/templates";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { GiftCardService, formatCode } from "./gift-card.service";

type Payload = Record<string, unknown>;

function mail(
  title: string,
  lines: string[],
  cta?: { label: string; href: string },
  l: EmailLocale = "en",
): RenderedEmail {
  return {
    subject: title,
    text: [...lines, ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join("\n"),
    html: layout(
      title,
      lines.map((x) => (x === "" ? "&nbsp;" : esc(x))),
      cta,
      l,
    ),
  };
}

/**
 * Emails for orders and gift cards (ADR-0032), sent from outbox events so
 * each message is retried on its own. Customer emails follow the buyer's
 * language (ADR-0036); staff alerts are English and go to the "Email for
 * purchase alerts" setting (default pegah.com.bd@gmail.com).
 */
@Injectable()
export class CommerceMailer {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(IntegrationSettings) private readonly settings: IntegrationSettings,
    @Inject(GiftCardService) private readonly giftCards: GiftCardService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  handles(type: string): boolean {
    return type.startsWith("order.") || type === "giftcard.deliver";
  }

  private link(path: string): string | null {
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    return base ? `${base}${path}` : null;
  }

  private async send(to: string, template: string, m: RenderedEmail): Promise<void> {
    const result = await this.email.send({ to, template, ...m });
    if (result === "FAILED") throw new Error(`Email ${template} failed`);
  }

  async handle(type: string, aggregateId: string, payload: Payload): Promise<void> {
    if (type === "giftcard.deliver") return this.deliverGiftCard(aggregateId, payload);

    const o = await this.db.order.findUnique({
      where: { publicId: aggregateId },
      include: {
        offer: { select: { titleEn: true, titleBn: true } },
        user: { select: { locale: true } },
      },
    });
    if (!o) return;
    const l = emailLocale(o.user.locale);
    const total = taka(o.amountMinor.toString(), o.currency);
    const qty = o.quantity > 1 ? ` × ${o.quantity}` : "";
    const whatEn =
      o.kind === "GIFT_CARD"
        ? `Gift card for ${o.recipientName ?? o.buyerName}`
        : `${o.offer?.titleEn ?? "Offer"}${qty}`;
    const whatBn =
      o.kind === "GIFT_CARD"
        ? `${o.recipientName ?? o.buyerName}-এর জন্য গিফট কার্ড`
        : `${o.offer?.titleBn ?? o.offer?.titleEn ?? "অফার"}${qty}`;
    const staffFacts = [`Order: ${o.reference}`, whatEn, `Total: ${total}`];
    const buyerFacts =
      l === "bn" ? [`অর্ডার: ${o.reference}`, whatBn, `মোট: ${total}`] : staffFacts;
    const contact = this.settings.publicSite().general;
    const orderLink = this.link(`/account/orders/${o.publicId}`);
    const staffLink = this.link(`/admin/orders/${o.publicId}`);
    const buyerLine = [`Buyer: ${o.buyerName} · ${o.buyerPhone} · ${o.buyerEmail}`];
    const viewOrder = orderLink
      ? { label: l === "bn" ? "আপনার অর্ডার দেখুন" : "View your order", href: orderLink }
      : undefined;
    const console = staffLink ? { label: "Open in the console", href: staffLink } : undefined;

    switch (type) {
      case "order.created.buyer": {
        const online = this.settings.paymentProvider() !== null;
        const next =
          l === "bn"
            ? online
              ? "অর্ডার পেজ থেকে পেমেন্ট সম্পন্ন করুন। পেমেন্ট না পাওয়া পর্যন্ত অর্ডার কনফার্ম নয়।"
              : `পেমেন্ট সম্পন্ন করতে (বিকাশ, ব্যাংক ট্রান্সফার বা নগদ টাকা) আমাদের টিম শিগগিরই আপনাকে ফোন করবে। প্রশ্ন থাকলে: ${contact.supportPhone} · ${contact.supportEmail}`
            : online
              ? "Complete the payment from your order page. It is not confirmed until payment is received."
              : `Our team will call you shortly to complete the payment (bKash, bank transfer or cash). Questions? ${contact.supportPhone} · ${contact.supportEmail}`;
        return this.send(
          o.buyerEmail,
          "order-received",
          mail(
            l === "bn"
              ? `আপনার অর্ডার পেয়েছি · ${o.reference}`
              : `We received your order · ${o.reference}`,
            [
              hello(o.buyerName, l),
              "",
              l === "bn"
                ? "পেগাহ বেছে নেওয়ার জন্য ধন্যবাদ। আপনার অর্ডারটি আমরা পেয়েছি:"
                : "Thank you for choosing Pegah. We received your order:",
              ...buyerFacts,
              "",
              next,
            ],
            viewOrder,
            l,
          ),
        );
      }
      case "order.created.staff":
        return this.send(
          this.settings.notificationEmail(),
          "staff-order-created",
          mail(
            `New ${o.kind === "GIFT_CARD" ? "gift card" : "offer"} order · ${o.reference}`,
            [
              "A customer placed a new order on the website.",
              "",
              ...staffFacts,
              ...buyerLine,
              ...(o.note ? [`Note: ${o.note}`] : []),
              "",
              "Status: awaiting payment. If they pay offline, record it with “Mark as paid” in the console.",
            ],
            console,
          ),
        );
      case "order.paid.buyer": {
        const after =
          l === "bn"
            ? o.kind === "GIFT_CARD"
              ? `গিফট কার্ডের কোড ${o.recipientEmail ?? o.buyerEmail} ঠিকানায় ইমেইল করা হয়েছে।`
              : `বিস্তারিত ঠিক করতে আমাদের টিম আপনার সাথে যোগাযোগ করবে। প্রশ্ন থাকলে: ${contact.supportPhone}`
            : o.kind === "GIFT_CARD"
              ? `The gift card code has been emailed to ${o.recipientEmail ?? o.buyerEmail}.`
              : `Our team will contact you to arrange the details. Questions? ${contact.supportPhone}`;
        return this.send(
          o.buyerEmail,
          "order-paid",
          mail(
            l === "bn" ? `পেমেন্ট পেয়েছি · ${o.reference}` : `Payment received · ${o.reference}`,
            [
              hello(o.buyerName, l),
              "",
              l === "bn"
                ? "আপনার পেমেন্ট আমরা পেয়েছি। ধন্যবাদ!"
                : "We received your payment. Thank you!",
              ...buyerFacts,
              "",
              after,
            ],
            viewOrder,
            l,
          ),
        );
      }
      case "order.paid.staff":
        return this.send(
          this.settings.notificationEmail(),
          "staff-order-paid",
          mail(
            `Paid: ${o.reference}`,
            [
              "An order has been paid.",
              "",
              ...staffFacts,
              ...buyerLine,
              o.paidOffline ? `Recorded offline: ${o.paidOffline}` : "Paid online.",
            ],
            console,
          ),
        );
      case "order.payment_review.staff":
        return this.send(
          this.settings.notificationEmail(),
          "staff-order-review",
          mail(
            `Check payment: ${o.reference}`,
            [
              "A payment arrived for this order but needs a staff decision (amount, risk flag, or the order was no longer open).",
              "",
              ...staffFacts,
              ...buyerLine,
            ],
            console,
          ),
        );
      default:
        return;
    }
  }

  private async deliverGiftCard(publicId: string, payload: Payload): Promise<void> {
    const card = await this.db.giftCard.findUnique({
      where: { publicId },
      include: { order: { select: { user: { select: { locale: true } } } } },
    });
    if (!card || card.status !== "ACTIVE") return;
    const code = await this.giftCards.revealCode(card.id);
    if (!code)
      throw new Error("Gift card code cannot be unsealed (encryption key missing or changed)");
    // The buyer chose the language; cards issued by staff are in English.
    const l = emailLocale(card.order?.user.locale);
    const from = typeof payload.from === "string" ? payload.from : "Pegah";
    const message = typeof payload.message === "string" && payload.message ? payload.message : null;
    const amount = taka(card.balanceMinor.toString(), card.currency);
    const expires = card.expiresAt.toISOString().slice(0, 10);
    const balanceLink = this.link("/gift-cards/balance");
    const lines =
      l === "bn"
        ? [
            hello(card.recipientName, l),
            "",
            `${from} আপনাকে ${amount} মূল্যের একটি পেগাহ ট্রাভেল গিফট কার্ড উপহার দিয়েছেন।`,
            ...(message ? ["", `“${message}”`] : []),
            "",
            `আপনার গিফট কার্ড কোড: ${formatCode(code)}`,
            `${expires} পর্যন্ত বৈধ। পেগাহ-তে হোটেল বা ট্যুর বুক করার সময় চেকআউটে এটি ব্যবহার করুন।`,
            "",
            "কোডটি গোপন রাখুন: যার কাছে কোড থাকবে, সে-ই ব্যালান্স ব্যবহার করতে পারবে।",
          ]
        : [
            hello(card.recipientName, l),
            "",
            `${from} has given you a Pegah travel gift card worth ${amount}.`,
            ...(message ? ["", `“${message}”`] : []),
            "",
            `Your gift card code: ${formatCode(code)}`,
            `Valid until ${expires}. Use it at checkout when you book a stay or tour on Pegah.`,
            "",
            "Keep this code private: anyone with it can use the balance.",
          ];
    await this.send(
      card.recipientEmail,
      "gift-card",
      mail(
        l === "bn"
          ? `${from} আপনাকে একটি পেগাহ গিফট কার্ড পাঠিয়েছেন`
          : `${from} sent you a Pegah gift card`,
        lines,
        balanceLink
          ? { label: l === "bn" ? "ব্যালান্স দেখুন" : "Check your balance", href: balanceLink }
          : undefined,
        l,
      ),
    );
  }
}
