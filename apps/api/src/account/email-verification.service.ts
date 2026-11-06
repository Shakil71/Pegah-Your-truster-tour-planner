import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { sha256Hex } from "../auth/session.service";
import { ProblemException } from "../common/problem";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { templates } from "../email/templates";
import { PRISMA, type Db } from "../prisma/prisma.service";
import { IntegrationSettings } from "../settings/integration-settings.service";

const VERIFY_TTL_MS = 48 * 60 * 60_000;

/**
 * Email verification for customer accounts (ADR-0035). A single-use link,
 * stored only as a SHA-256 hash, is emailed directly (never through the
 * outbox: the link is a credential). The newest link replaces older ones.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger("EmailVerification");

  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(IntegrationSettings) private readonly integrations: IntegrationSettings,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Sends a fresh link. Silently does nothing for verified or non-customer accounts. */
  async send(userId: bigint, ip: string | null, now: Date = new Date()): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || user.kind !== "CUSTOMER" || user.status !== "ACTIVE" || user.emailVerifiedAt) {
      return;
    }
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    if (!base) return;
    const token = randomBytes(32).toString("base64url");
    await this.db.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.emailVerificationToken.create({
        data: {
          tokenHash: sha256Hex(token),
          userId: user.id,
          expiresAt: new Date(now.getTime() + VERIFY_TTL_MS),
        },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "account.email_verification_sent",
          targetType: "user",
          targetId: user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
    await this.email.send({
      to: user.email,
      template: "email-verification",
      ...templates.emailVerification(user.fullName, `${base}/verify-email?token=${token}`),
    });
  }

  /** Called right after sign-up; a mail problem never fails the registration. */
  async sendAfterRegister(userPublicId: string, ip: string | null): Promise<void> {
    try {
      const user = await this.db.user.findUnique({
        where: { publicId: userPublicId },
        select: { id: true },
      });
      if (user) await this.send(user.id, ip);
    } catch (error) {
      this.logger.warn({ err: error }, "Could not send the verification email");
    }
  }

  async verify(token: string, ip: string | null, now: Date = new Date()): Promise<void> {
    const invalid = () =>
      new ProblemException(
        400,
        "verification-link-invalid",
        "This verification link is invalid or has expired",
        "Sign in and ask for a new link from your account.",
      );
    const row = await this.db.emailVerificationToken.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt <= now || row.user.status !== "ACTIVE") throw invalid();
    await this.db.$transaction(async (tx) => {
      const used = await tx.emailVerificationToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count !== 1) throw invalid();
      await tx.user.updateMany({
        where: { id: row.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: row.userId,
          action: "account.email_verified",
          targetType: "user",
          targetId: row.user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
  }

  /** Booking and order guard: throws when the console requires a verified email. */
  async assertVerified(userId: bigint): Promise<void> {
    if (!this.integrations.requireVerifiedEmail()) return;
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { kind: true, emailVerifiedAt: true },
    });
    if (user?.kind === "CUSTOMER" && !user.emailVerifiedAt) {
      throw new ProblemException(
        403,
        "email-not-verified",
        "Please verify your email first",
        "Open the link we emailed you, or ask for a new one from your account page.",
      );
    }
  }
}
