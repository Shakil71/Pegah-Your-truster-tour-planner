import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { emailLocale, esc, hello, layout, type RenderedEmail } from "../email/templates";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";

const TOPIC: Record<string, { en: string; bn: string }> = {
  BOOKING: { en: "a new booking", bn: "নতুন বুকিং" },
  RESERVATION: { en: "an existing reservation", bn: "বিদ্যমান রিজার্ভেশন" },
  PACKAGE: { en: "a package or offer", bn: "প্যাকেজ বা অফার" },
  OTHER: { en: "a question", bn: "একটি প্রশ্ন" },
};

/**
 * Contact form emails (ADR-0041), sent from outbox events: an
 * acknowledgement to the sender in their language, and an alert to the
 * staff address in English.
 */
@Injectable()
export class ContactMailer {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(IntegrationSettings) private readonly settings: IntegrationSettings,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  handles(type: string): boolean {
    return type.startsWith("contact.");
  }

  private async send(to: string, template: string, m: RenderedEmail): Promise<void> {
    const result = await this.email.send({ to, template, ...m });
    if (result === "FAILED") throw new Error(`Email ${template} failed`);
  }

  private mail(
    title: string,
    lines: string[],
    cta?: { label: string; href: string },
    l: "en" | "bn" = "en",
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

  async handle(type: string, publicId: string, payload: Record<string, unknown>): Promise<void> {
    const m = await this.db.contactMessage.findUnique({ where: { publicId } });
    if (!m) return;
    const topic = TOPIC[m.topic] ?? TOPIC.OTHER!;
    const contact = this.settings.publicSite().general;
    const trip = [
      ...(m.travelDate ? [`Travel date: ${m.travelDate.toISOString().slice(0, 10)}`] : []),
      ...(m.guests ? [`Guests: ${m.guests}`] : []),
    ];

    if (type === "contact.created.customer") {
      const l = emailLocale(typeof payload.locale === "string" ? payload.locale : null);
      const lines =
        l === "bn"
          ? [
              hello(m.name, l),
              "",
              `আপনার বার্তা পেয়েছি (${topic.bn}): ${m.reference}`,
              "একজন ট্রাভেল প্ল্যানার শিগগিরই ফোন বা ইমেইলে উত্তর দেবেন। বার্তা পাঠানোয় কোনো বুকিং কনফার্ম বা হোল্ড হয় না।",
              "",
              `জরুরি হলে: ${contact.supportPhone} · ${contact.supportEmail}`,
            ]
          : [
              hello(m.name, l),
              "",
              `We received your message about ${topic.en}: ${m.reference}`,
              "A travel planner will reply by phone or email soon. Sending a message does not hold or confirm a booking.",
              "",
              `Urgent? ${contact.supportPhone} · ${contact.supportEmail}`,
            ];
      return this.send(
        m.email,
        "contact-received",
        this.mail(
          l === "bn"
            ? `আপনার বার্তা পেয়েছি · ${m.reference}`
            : `We received your message · ${m.reference}`,
          lines,
          undefined,
          l,
        ),
      );
    }

    if (type === "contact.created.staff") {
      const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
      return this.send(
        this.settings.notificationEmail(),
        "staff-contact-created",
        this.mail(
          `New contact message · ${m.reference}`,
          [
            `About ${topic.en}.`,
            "",
            `From: ${m.name} · ${m.phone} · ${m.email}`,
            ...trip,
            "",
            m.message,
          ],
          base ? { label: "Open in the console", href: `${base}/admin/messages` } : undefined,
        ),
      );
    }
  }
}
