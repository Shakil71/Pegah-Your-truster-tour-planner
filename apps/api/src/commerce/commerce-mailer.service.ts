import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { taka } from "../email/taka";
import { esc, layout, type RenderedEmail } from "../email/templates";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { GiftCardService, formatCode } from "./gift-card.service";

type Payload = Record<string, unknown>;

function mail(
  title: string,
  lines: string[],
  cta?: { label: string; href: string },
): RenderedEmail {
  return {
    subject: title,
    text: [...lines, ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join("\n"),
    html: layout(
      title,
      lines.map((l) => (l === "" ? "&nbsp;" : esc(l))),
      cta,
    ),
  };
}

/**
 * Emails for orders and gift cards (ADR-0032), sent from outbox events so
 * each message is retried on its own. Staff alerts go to the "Email for
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
      include: { offer: { select: { titleEn: true } } },
    });
    if (!o) return;
    const what =
      o.kind === "GIFT_CARD"
        ? `Gift card for ${o.recipientName ?? o.buyerName}`
        : `${o.offer?.titleEn ?? "Offer"}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`;
    const total = taka(o.amountMinor.toString(), o.currency);
    const facts = [`Order: ${o.reference}`, what, `Total: ${total}`];
    const contact = this.settings.publicSite().general;
    const orderLink = this.link(`/account/orders/${o.publicId}`);
    const staffLink = this.link(`/admin/orders/${o.publicId}`);
    const buyerFacts = [`Buyer: ${o.buyerName} · ${o.buyerPhone} · ${o.buyerEmail}`];

    switch (type) {
      case "order.created.buyer": {
        const online = this.settings.paymentProvider() !== null;
        return this.send(
          o.buyerEmail,
          "order-received",
          mail(
            `We received your order · ${o.reference}`,
            [
              `Hello ${o.buyerName},`,
              "",
              "Thank you for choosing Pegah. We received your order:",
              ...facts,
              "",
              online
                ? "Complete the payment from your order page. It is not confirmed until payment is received."
                : `Our team will call you shortly to complete the payment (bKash, bank transfer or cash). Questions? ${contact.supportPhone} · ${contact.supportEmail}`,
            ],
            orderLink ? { label: "View your order", href: orderLink } : undefined,
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
              ...facts,
              ...buyerFacts,
              ...(o.note ? [`Note: ${o.note}`] : []),
              "",
              "Status: awaiting payment. If they pay offline, record it with “Mark as paid” in the console.",
            ],
            staffLink ? { label: "Open in the console", href: staffLink } : undefined,
          ),
        );
      case "order.paid.buyer":
        return this.send(
          o.buyerEmail,
          "order-paid",
          mail(
            `Payment received · ${o.reference}`,
            [
              `Hello ${o.buyerName},`,
              "",
              "We received your payment. Thank you!",
              ...facts,
              "",
              o.kind === "GIFT_CARD"
                ? `The gift card code has been emailed to ${o.recipientEmail ?? o.buyerEmail}.`
                : `Our team will contact you to arrange the details. Questions? ${contact.supportPhone}`,
            ],
            orderLink ? { label: "View your order", href: orderLink } : undefined,
          ),
        );
      case "order.paid.staff":
        return this.send(
          this.settings.notificationEmail(),
          "staff-order-paid",
          mail(
            `Paid: ${o.reference}`,
            [
              "An order has been paid.",
              "",
              ...facts,
              ...buyerFacts,
              o.paidOffline ? `Recorded offline: ${o.paidOffline}` : "Paid online.",
            ],
            staffLink ? { label: "Open in the console", href: staffLink } : undefined,
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
              ...facts,
              ...buyerFacts,
            ],
            staffLink ? { label: "Open in the console", href: staffLink } : undefined,
          ),
        );
      default:
        return;
    }
  }

  private async deliverGiftCard(publicId: string, payload: Payload): Promise<void> {
    const card = await this.db.giftCard.findUnique({ where: { publicId } });
    if (!card || card.status !== "ACTIVE") return;
    const code = await this.giftCards.revealCode(card.id);
    if (!code)
      throw new Error("Gift card code cannot be unsealed (encryption key missing or changed)");
    const from = typeof payload.from === "string" ? payload.from : "Pegah";
    const message = typeof payload.message === "string" && payload.message ? payload.message : null;
    const amount = taka(card.balanceMinor.toString(), card.currency);
    const expires = card.expiresAt.toISOString().slice(0, 10);
    const balanceLink = this.link("/gift-cards/balance");
    await this.send(
      card.recipientEmail,
      "gift-card",
      mail(
        `${from} sent you a Pegah gift card`,
        [
          `Hello ${card.recipientName},`,
          "",
          `${from} has given you a Pegah travel gift card worth ${amount}.`,
          ...(message ? ["", `“${message}”`] : []),
          "",
          `Your gift card code: ${formatCode(code)}`,
          `Valid until ${expires}. Use it at checkout when you book a stay or tour on Pegah.`,
          "",
          "Keep this code private: anyone with it can use the balance.",
        ],
        balanceLink ? { label: "Check your balance", href: balanceLink } : undefined,
      ),
    );
  }
}
