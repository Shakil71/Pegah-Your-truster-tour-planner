import { Inject, Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";
import { APP_CONFIG, type AppConfig } from "../config/config";
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
 * reset link). Transport is chosen by EMAIL_TRANSPORT:
 *  - none: recorded as SKIPPED (default until SMTP credentials exist);
 *  - log:  recipient and subject written to the log (development);
 *  - smtp: sent with STARTTLS or implicit TLS; plain-text SMTP is refused.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger("Email");
  private readonly transporter: Transporter | null;

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.transporter =
      config.EMAIL_TRANSPORT === "smtp"
        ? createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_SECURE,
            requireTLS: !config.SMTP_SECURE,
            auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
          })
        : null;
  }

  get enabled(): boolean {
    return this.config.EMAIL_TRANSPORT !== "none";
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

    if (this.config.EMAIL_TRANSPORT === "none") {
      await finish("SKIPPED");
      return "SKIPPED";
    }
    if (this.config.EMAIL_TRANSPORT === "log") {
      this.logger.log(
        { to: msg.to, template: msg.template, subject: msg.subject },
        "Email (log transport)",
      );
      await finish("SENT", { providerId: "log" });
      return "SENT";
    }
    try {
      const info = await this.transporter!.sendMail({
        from: this.config.EMAIL_FROM,
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
