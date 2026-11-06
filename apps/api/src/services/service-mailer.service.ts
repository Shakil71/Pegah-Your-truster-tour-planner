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
import { titleOf } from "./service-request.service";

type Payload = Record<string, unknown>;

function mail(
  title: string,
  lines: string[],
  cta: { label: string; href: string } | undefined,
  l: EmailLocale,
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

const SUBJECT: Record<string, { en: string; bn: string }> = {
  NEEDS_INFO: { en: "We need a few more details", bn: "আরও কিছু তথ্য প্রয়োজন" },
  QUOTE: { en: "Your price is ready", bn: "আপনার মূল্য প্রস্তুত" },
  MARK_PAID: { en: "Payment received", bn: "পেমেন্ট পেয়েছি" },
  START: { en: "We are working on your request", bn: "আপনার অনুরোধের কাজ চলছে" },
  COMPLETE: { en: "Your request is complete", bn: "আপনার অনুরোধ সম্পন্ন হয়েছে" },
  REJECT: { en: "About your request", bn: "আপনার অনুরোধ সম্পর্কে" },
  CANCEL: { en: "Your request was cancelled", bn: "আপনার অনুরোধ বাতিল হয়েছে" },
  NOTE: { en: "New message about your request", bn: "আপনার অনুরোধ সম্পর্কে নতুন বার্তা" },
};

/**
 * Emails for visa and flight requests (ADR-0039), sent from outbox events.
 * Customer emails follow their language (ADR-0036); staff alerts go to the
 * purchase-alert address in English.
 */
@Injectable()
export class ServiceMailer {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(IntegrationSettings) private readonly settings: IntegrationSettings,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  handles(type: string): boolean {
    return type.startsWith("service.");
  }

  private link(path: string): string | null {
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    return base ? `${base}${path}` : null;
  }

  private async send(to: string, template: string, m: RenderedEmail): Promise<void> {
    const result = await this.email.send({ to, template, ...m });
    if (result === "FAILED") throw new Error(`Email ${template} failed`);
  }

  async handle(type: string, publicId: string, payload: Payload): Promise<void> {
    const r = await this.db.serviceRequest.findUnique({
      where: { publicId },
      include: {
        visaProduct: { select: { country: true, visaType: true, requirements: true } },
        user: { select: { locale: true } },
      },
    });
    if (!r) return;
    const l = emailLocale(r.user.locale);
    const what = titleOf(r);
    const mine = this.link(`/account/requests/${r.publicId}`);
    const cta = mine
      ? { label: l === "bn" ? "অনুরোধ দেখুন" : "View your request", href: mine }
      : undefined;
    const staffLink = this.link(`/admin/requests/${r.publicId}`);
    const consoleCta = staffLink ? { label: "Open in the console", href: staffLink } : undefined;
    const contact = this.settings.publicSite().general;
    const kindEn = r.kind === "VISA" ? "visa application" : "flight request";
    const kindBn = r.kind === "VISA" ? "ভিসা আবেদন" : "ফ্লাইট অনুরোধ";

    switch (type) {
      case "service.created.customer": {
        const docs =
          r.kind === "VISA" && Array.isArray(r.visaProduct?.requirements)
            ? (r.visaProduct.requirements as unknown[]).filter(
                (x): x is string => typeof x === "string",
              )
            : [];
        const lines =
          l === "bn"
            ? [
                hello(r.contactName, l),
                "",
                `আপনার ${kindBn} পেয়েছি: ${r.reference}`,
                what,
                "",
                "আমাদের টিম যাচাই করে মূল্য জানাবে। মূল্য পরিশোধ ও নিশ্চিতকরণের আগে কিছুই কনফার্ম নয়।",
                ...(docs.length
                  ? [
                      "",
                      "প্রয়োজনীয় কাগজপত্র (অনুরোধ পেজ থেকে আপলোড করুন):",
                      ...docs.map((d) => `• ${d}`),
                    ]
                  : []),
                "",
                `প্রশ্ন থাকলে: ${contact.supportPhone} · ${contact.supportEmail}`,
              ]
            : [
                hello(r.contactName, l),
                "",
                `We received your ${kindEn}: ${r.reference}`,
                what,
                "",
                "Our team will check it and send you a price. Nothing is confirmed until you have paid and we confirm it.",
                ...(docs.length
                  ? [
                      "",
                      "Documents we need (upload them on your request page):",
                      ...docs.map((d) => `• ${d}`),
                    ]
                  : []),
                "",
                `Questions? ${contact.supportPhone} · ${contact.supportEmail}`,
              ];
        return this.send(
          r.contactEmail,
          "service-received",
          mail(
            l === "bn"
              ? `আপনার অনুরোধ পেয়েছি · ${r.reference}`
              : `We received your request · ${r.reference}`,
            lines,
            cta,
            l,
          ),
        );
      }
      case "service.created.staff":
        return this.send(
          this.settings.notificationEmail(),
          "staff-service-created",
          mail(
            `New ${kindEn} · ${r.reference}`,
            [
              `A customer sent a new ${kindEn}.`,
              "",
              what,
              `Travellers: ${r.travellers}`,
              `Customer: ${r.contactName} · ${r.contactPhone} · ${r.contactEmail}`,
              ...(r.note ? [`Note: ${r.note}`] : []),
              "",
              "Next: check it, ask for anything missing, then send a quote from the console.",
            ],
            consoleCta,
            "en",
          ),
        );
      case "service.reply.staff": {
        const what2 = payload.cancelled
          ? "The customer cancelled the request."
          : payload.document
            ? `The customer uploaded a document: ${String(payload.document)}.`
            : `The customer replied: ${String(payload.message ?? "")}`;
        return this.send(
          this.settings.notificationEmail(),
          "staff-service-reply",
          mail(
            `Update on ${r.reference}`,
            [what2, "", what, `Customer: ${r.contactName} · ${r.contactPhone}`],
            consoleCta,
            "en",
          ),
        );
      }
      case "service.updated.customer": {
        const action = String(payload.action ?? "NOTE");
        const subject = SUBJECT[action] ?? SUBJECT.NOTE!;
        const message =
          typeof payload.message === "string" && payload.message ? payload.message : null;
        const quote = r.quoteMinor !== null ? taka(r.quoteMinor.toString(), r.currency) : null;
        const extra: string[] = [];
        if (action === "QUOTE" && quote) {
          extra.push(
            l === "bn" ? `মোট মূল্য: ${quote}` : `Total price: ${quote}`,
            "",
            l === "bn"
              ? `পেমেন্টের জন্য (বিকাশ, ব্যাংক ট্রান্সফার বা নগদ) আমাদের টিম আপনাকে ফোন করবে, অথবা যোগাযোগ করুন: ${contact.supportPhone}`
              : `To pay (bKash, bank transfer or cash), our team will call you, or contact us: ${contact.supportPhone}`,
          );
        }
        if (action === "REJECT" || action === "CANCEL") {
          if (payload.wasPaid) {
            extra.push(
              l === "bn"
                ? "আপনি যা পরিশোধ করেছেন তার রিফান্ড নিয়ে আমাদের টিম যোগাযোগ করবে।"
                : "Our team will contact you about refunding what you paid.",
            );
          }
        }
        return this.send(
          r.contactEmail,
          `service-${action.toLowerCase()}`,
          mail(
            `${l === "bn" ? subject.bn : subject.en} · ${r.reference}`,
            [
              hello(r.contactName, l),
              "",
              what,
              ...(message ? ["", message] : []),
              ...(extra.length ? ["", ...extra] : []),
            ],
            cta,
            l,
          ),
        );
      }
      default:
        return;
    }
  }
}
