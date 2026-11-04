import { Inject, Injectable } from "@nestjs/common";
import type {
  ChangePassword,
  PasswordResetConfirm,
  Profile,
  Traveller,
  TravellerInput,
  UpdateProfile,
} from "@pegah/contracts";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { PasswordService } from "../auth/password.service";
import { sha256Hex } from "../auth/session.service";
import { newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { formatCalendarDate, parseCalendarDate } from "../common/time";
import { APP_CONFIG, type AppConfig } from "../config/config";
import { EmailService } from "../email/email.service";
import { templates } from "../email/templates";
import { PRISMA, type Db } from "../prisma/prisma.service";

const RESET_TTL_MS = 30 * 60_000;
const MAX_TRAVELLERS = 20;

/**
 * Customer self-service (ADR-0024): profile, password change, password reset
 * and saved travellers. Ownership is part of every query.
 */
@Injectable()
export class AccountService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async profile(userId: bigint): Promise<Profile> {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: u.publicId,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateProfile(
    auth: AuthContext,
    input: UpdateProfile,
    ip: string | null,
  ): Promise<Profile> {
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: auth.user.id },
        data: { fullName: input.fullName, phone: input.phone },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: auth.user.id,
          action: "account.profile_updated",
          targetType: "user",
          targetId: auth.user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
    return this.profile(auth.user.id);
  }

  /** Changes the password and signs out every other session. */
  async changePassword(auth: AuthContext, input: ChangePassword, ip: string | null): Promise<void> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: auth.user.id } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new ProblemException(422, "wrong-password", "Current password is incorrect");
    }
    const hash = await this.passwords.hash(input.newPassword);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null, id: { not: auth.sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorType: auth.kind === "STAFF" ? "STAFF" : "CUSTOMER",
          actorUserId: user.id,
          action: "account.password_changed",
          targetType: "user",
          targetId: user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
  }

  /**
   * Starts a reset. Always succeeds from the caller's point of view, so the
   * endpoint never reveals whether an email is registered. Customers only.
   */
  async requestPasswordReset(
    email: string,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || user.kind !== "CUSTOMER" || user.status !== "ACTIVE") return;
    const token = randomBytes(32).toString("base64url");
    await this.db.$transaction(async (tx) => {
      // Only the newest link works.
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.passwordResetToken.create({
        data: {
          tokenHash: sha256Hex(token),
          userId: user.id,
          expiresAt: new Date(now.getTime() + RESET_TTL_MS),
        },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: user.id,
          action: "account.password_reset_requested",
          targetType: "user",
          targetId: user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
    const base = this.config.PUBLIC_BASE_URL?.replace(/\/$/, "");
    const link = base ? `${base}/reset-password?token=${token}` : null;
    if (!link) return;
    // Sent directly (not via the outbox): the link is a credential and is never stored.
    await this.email.send({
      to: user.email,
      template: "password-reset",
      ...templates.passwordReset(user.fullName, link),
    });
  }

  async confirmPasswordReset(
    input: PasswordResetConfirm,
    ip: string | null,
    now: Date = new Date(),
  ): Promise<void> {
    const invalid = () =>
      new ProblemException(
        400,
        "reset-link-invalid",
        "This reset link is invalid or has expired",
        "Ask for a new link.",
      );
    const row = await this.db.passwordResetToken.findUnique({
      where: { tokenHash: sha256Hex(input.token) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt <= now || row.user.status !== "ACTIVE") throw invalid();
    const hash = await this.passwords.hash(input.newPassword);
    await this.db.$transaction(async (tx) => {
      const used = await tx.passwordResetToken.updateMany({
        where: { id: row.id, usedAt: null },
        data: { usedAt: now },
      });
      if (used.count !== 1) throw invalid();
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash: hash } });
      // Anyone who had access loses it.
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.record(
        {
          actorType: "CUSTOMER",
          actorUserId: row.userId,
          action: "account.password_reset",
          targetType: "user",
          targetId: row.user.publicId,
          ipAddress: ip,
        },
        tx,
      );
    });
  }

  // ── Saved travellers ──────────────────────────────────────────────────────

  async travellers(userId: bigint): Promise<Traveller[]> {
    const rows = await this.db.travellerProfile.findMany({
      where: { userId },
      orderBy: [{ ageGroup: "asc" }, { fullName: "asc" }],
    });
    return rows.map(toTraveller);
  }

  async addTraveller(userId: bigint, input: TravellerInput): Promise<Traveller> {
    const count = await this.db.travellerProfile.count({ where: { userId } });
    if (count >= MAX_TRAVELLERS) {
      throw new ProblemException(
        422,
        "too-many-travellers",
        `You can save up to ${MAX_TRAVELLERS} travellers`,
      );
    }
    const row = await this.db.travellerProfile.create({
      data: { ...travellerData(input), publicId: newPublicId(), userId },
    });
    return toTraveller(row);
  }

  async updateTraveller(userId: bigint, id: string, input: TravellerInput): Promise<Traveller> {
    const updated = await this.db.travellerProfile.updateMany({
      where: { publicId: id, userId },
      data: travellerData(input),
    });
    if (updated.count !== 1)
      throw new ProblemException(404, "traveller-not-found", "Traveller not found");
    return toTraveller(
      await this.db.travellerProfile.findUniqueOrThrow({ where: { publicId: id } }),
    );
  }

  async deleteTraveller(userId: bigint, id: string): Promise<void> {
    const deleted = await this.db.travellerProfile.deleteMany({ where: { publicId: id, userId } });
    if (deleted.count !== 1)
      throw new ProblemException(404, "traveller-not-found", "Traveller not found");
  }
}

function travellerData(input: TravellerInput) {
  return {
    fullName: input.fullName,
    ageGroup: input.ageGroup,
    dateOfBirth: input.dateOfBirth ? parseCalendarDate(input.dateOfBirth) : null,
    nationality: input.nationality,
  };
}

function toTraveller(r: {
  publicId: string;
  fullName: string;
  ageGroup: "ADULT" | "CHILD";
  dateOfBirth: Date | null;
  nationality: string | null;
}): Traveller {
  return {
    id: r.publicId,
    fullName: r.fullName,
    ageGroup: r.ageGroup,
    dateOfBirth: r.dateOfBirth ? formatCalendarDate(r.dateOfBirth) : null,
    nationality: r.nationality,
  };
}
