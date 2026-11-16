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
    return (await this.deliver(msg)).status;
  }

  /**
   * Like send(), plus a plain-language reason when it fails, for the
   * console's "Send me a test email" button.
   */
  async deliver(
    msg: OutgoingEmail,
  ): Promise<{ status: "SENT" | "FAILED" | "SKIPPED"; reason: string | null }> {
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
      return { status: "SKIPPED", reason: null };
    }
    if (channel.transport === "log") {
      this.logger.log(
        { to: msg.to, template: msg.template, subject: msg.subject },
        "Email (log transport)",
      );
      await finish("SENT", { providerId: "log" });
      return { status: "SENT", reason: null };
    }
    if (!channel.transporter) {
      const reason = "SMTP is selected but the server or password is missing.";
      await finish("FAILED", { error: reason });
      return { status: "FAILED", reason };
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
      return { status: "SENT", reason: null };
    } catch (error) {
      const raw = error instanceof Error ? error.message : "send failed";
      this.logger.warn({ template: msg.template, reason: raw }, "Email failed");
      await finish("FAILED", { error: raw });
      return { status: "FAILED", reason: explainSmtpError(error) };
    }
  }
}

/**
 * Turns a nodemailer error into advice staff can act on. Nodemailer messages
 * never contain the password, so the short technical detail is safe to show.
 */
export function explainSmtpError(error: unknown): string {
  const e = (error ?? {}) as { code?: string; responseCode?: number; message?: string };
  const code = e.code ?? "";
  const rc = e.responseCode;
  const detail = `${[code, rc].filter(Boolean).join(" ")}: ${(e.message ?? "").slice(0, 160)}`;
  let advice: string;
  if (code === "EAUTH" || rc === 535 || rc === 534) {
    advice =
      "The mail server refused the user name or password. Use the full email address as the user name and type the mailbox password again.";
  } else if (code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(e.message ?? "")) {
    advice = "The SMTP server name could not be found. Check the spelling of the server.";
  } else if (
    code === "ETIMEDOUT" ||
    code === "ECONNECTION" ||
    /ECONNREFUSED|ETIMEDOUT|timeout/i.test(e.message ?? "")
  ) {
    advice =
      'Could not connect to the mail server. The web server may block this outgoing port: try port 587 with "Use TLS from the start" off, or ask the hosting provider to allow it.';
  } else if (/certificate|self.signed|altnames|SSL|TLS|wrong version/i.test(e.message ?? "")) {
    advice =
      "The secure connection failed. Use the server name from the hosting's mail settings, and port 465 with TLS from the start (or 587 without).";
  } else if (
    /recipients were rejected|recipient|user unknown|does not exist/i.test(e.message ?? "")
  ) {
    advice =
      "Sign-in worked, but the mail server could not deliver to that recipient address. Send the test to a real inbox you can open.";
  } else if (code === "EENVELOPE" || (rc !== undefined && rc >= 550 && rc <= 554)) {
    advice =
      "The mail server refused the sender or the recipient. The From address must be the same mailbox as the user name.";
  } else {
    advice = "Sending failed. Check the server, port, user name and password.";
  }
  return `${advice} (${detail})`.slice(0, 400);
}
