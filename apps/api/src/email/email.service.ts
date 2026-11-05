import { Inject, Injectable, Logger } from "@nestjs/common";
import { IntegrationSettings } from "../settings/integration-settings.service";
import { PRISMA, type Db } from "../prisma/prisma.service";
import type { RenderedEmail } from "./templates";

export interface OutgoingEmail extends RenderedEmail {
  to: string;
  template: string;
  bookingId?: bigint | null;
}

/**
 * Sends transactional email and records every attempt in `email_messages`
 * (recipient, template, subject, outcome — never the body, which may carry a
 * reset link). The transport comes from the console settings, or api.env
 * until they are saved (ADR-0029):
 *  - none: recorded as SKIPPED (default until SMTP credentials exist);
 *  - log:  recipient and subject written to the log (development);
 *  - smtp: sent with STARTTLS or implicit TLS; plain-text SMTP is refused.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger("Email");

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(IntegrationSettings) private readonly integrations: IntegrationSettings,
  ) {}

  get enabled(): boolean {
    return this.integrations.emailChannel().transport !== "none";
  }

  /** Sends one message; never throws (the caller's business action already succeeded). */
  async send(msg: OutgoingEmail): Promise<"SENT" | "FAILED" | "SKIPPED"> {
    const row = await this.db.emailMessage.create({
      data: {
        bookingId: msg.bookingId ?? null,
        toAddress: msg.to.slice(0, 254),
        template: msg.template,
        subject: msg.subject.slice(0, 200),
      },
      select: { id: true },
    });
    const finish = (
      status: "SENT" | "FAILED" | "SKIPPED",
      extra: { providerId?: string; error?: string } = {},
    ) =>
      this.db.emailMessage.update({
        where: { id: row.id },
        data: {
          status,
          providerId: extra.providerId?.slice(0, 200) ?? null,
          error: extra.error?.slice(0, 500) ?? null,
          sentAt: status === "SENT" ? new Date() : null,
        },
      });

    const channel = this.integrations.emailChannel();
    if (channel.transport === "none") {
      await finish("SKIPPED");
      return "SKIPPED";
    }
    if (channel.transport === "log") {
      this.logger.log(
        { to: msg.to, template: msg.template, subject: msg.subject },
        "Email (log transport)",
      );
      await finish("SENT", { providerId: "log" });
      return "SENT";
    }
    if (!channel.transporter) {
      await finish("FAILED", { error: "SMTP is selected but not fully configured" });
      return "FAILED";
    }
    try {
      const info = await channel.transporter.sendMail({
        from: channel.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      await finish("SENT", { providerId: String(info.messageId ?? "") });
      return "SENT";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "send failed";
      this.logger.warn({ template: msg.template, reason }, "Email failed");
      await finish("FAILED", { error: reason });
      return "FAILED";
    }
  }
}
