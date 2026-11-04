import { Inject, Injectable } from "@nestjs/common";
import {
  PERMISSION_KEYS,
  type CreateStaffRequest,
  type Permission,
  type StaffListResponse,
  type StaffMember,
  type UpdateStaffRequest,
} from "@pegah/contracts";
import { Prisma } from "@pegah/db";
import { AuditService } from "../audit/audit.service";
import type { AuthContext } from "../auth/auth.types";
import { PasswordService } from "../auth/password.service";
import { newPublicId } from "../common/ids";
import { ProblemException } from "../common/problem";
import { PRISMA, type Db } from "../prisma/prisma.service";

const KNOWN = new Set<string>(PERMISSION_KEYS);
const STAFF_INCLUDE = { roles: { include: { role: { select: { key: true } } } } } as const;
type StaffRow = Prisma.UserGetPayload<{ include: typeof STAFF_INCLUDE }>;

function toStaff(u: StaffRow): StaffMember {
  return {
    id: u.publicId,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    status: u.status,
    roles: u.roles.map((r) => r.role.key).sort(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Staff accounts and role grants. Rules (SECURITY_MODEL.md):
 *  - only an owner can grant or remove the owner role, or change an owner;
 *  - nobody can disable themselves or drop their own roles;
 *  - at least one active owner must remain;
 *  - disabling a person revokes their sessions immediately.
 * Every change is audited in the same transaction.
 */
@Injectable()
export class StaffService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<StaffListResponse> {
    const [users, roles] = await Promise.all([
      this.db.user.findMany({
        where: { kind: "STAFF" },
        orderBy: [{ status: "asc" }, { fullName: "asc" }],
        include: STAFF_INCLUDE,
      }),
      this.db.role.findMany({
        orderBy: { id: "asc" },
        include: {
          permissions: { include: { permission: { select: { key: true } } } },
          _count: { select: { users: true } },
        },
      }),
    ]);
    return {
      items: users.map(toStaff),
      roles: roles.map((r) => ({
        key: r.key,
        name: r.name,
        description: r.description,
        permissions: r.permissions
          .map((p) => p.permission.key)
          .filter((k): k is Permission => KNOWN.has(k))
          .sort(),
        memberCount: r._count.users,
      })),
    };
  }

  async create(
    input: CreateStaffRequest,
    actor: AuthContext,
    ip: string | null,
  ): Promise<StaffMember> {
    this.assertMayGrant(input.roles, actor);
    const roles = await this.db.role.findMany({ where: { key: { in: input.roles } } });
    if (roles.length !== new Set(input.roles).size) {
      throw new ProblemException(422, "unknown-role", "Unknown role", "Run seed:rbac first.");
    }
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            publicId: newPublicId(),
            email: input.email,
            fullName: input.fullName,
            phone: input.phone ?? null,
            passwordHash,
            kind: "STAFF",
            roles: { create: roles.map((r) => ({ roleId: r.id, grantedById: actor.user.id })) },
          },
          include: STAFF_INCLUDE,
        });
        await this.audit.record(
          {
            actorType: "STAFF",
            actorUserId: actor.user.id,
            action: "staff.created",
            targetType: "user",
            targetId: user.publicId,
            ipAddress: ip,
            metadata: { email: user.email, roles: input.roles },
          },
          tx,
        );
        return toStaff(user);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProblemException(
          409,
          "email-taken",
          "Email already registered",
          "An account with this email already exists.",
        );
      }
      throw error;
    }
  }

  async update(
    publicId: string,
    input: UpdateStaffRequest,
    actor: AuthContext,
    ip: string | null,
  ): Promise<StaffMember> {
    return this.db.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { publicId, kind: "STAFF" },
        include: STAFF_INCLUDE,
      });
      if (!target) throw new ProblemException(404, "staff-not-found", "Staff member not found");
      const self = target.id === actor.user.id;
      const currentRoles = target.roles.map((r) => r.role.key);
      const isOwner = actor.roles.includes("owner");

      if (currentRoles.includes("owner") && !isOwner) {
        throw new ProblemException(
          403,
          "forbidden",
          "Forbidden",
          "Only an owner can change an owner.",
        );
      }
      if (self && input.status === "DISABLED") {
        throw new ProblemException(422, "cannot-disable-self", "You cannot disable yourself");
      }
      if (self && input.roles && currentRoles.some((r) => !input.roles!.includes(r as never))) {
        throw new ProblemException(422, "cannot-demote-self", "You cannot remove your own roles");
      }
      if (input.roles) {
        const added = input.roles.filter((r) => !currentRoles.includes(r));
        const removed = currentRoles.filter((r) => !input.roles!.includes(r as never));
        this.assertMayGrant([...added, ...removed], actor);
      }

      const losesOwner =
        currentRoles.includes("owner") &&
        (input.status === "DISABLED" ||
          (input.roles !== undefined && !input.roles.includes("owner")));
      if (losesOwner) {
        const owners = await tx.userRole.count({
          where: { role: { key: "owner" }, user: { status: "ACTIVE", kind: "STAFF" } },
        });
        if (owners <= 1) {
          throw new ProblemException(
            422,
            "last-owner",
            "At least one owner must remain",
            "Make someone else an owner first.",
          );
        }
      }

      if (input.roles) {
        const roles = await tx.role.findMany({ where: { key: { in: input.roles } } });
        await tx.userRole.deleteMany({ where: { userId: target.id } });
        await tx.userRole.createMany({
          data: roles.map((r) => ({ userId: target.id, roleId: r.id, grantedById: actor.user.id })),
        });
      }
      if (input.status) {
        await tx.user.update({ where: { id: target.id }, data: { status: input.status } });
      }
      if (input.status === "DISABLED") {
        // Permissions are re-read on every request; a disabled person must also lose sessions now.
        await tx.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          actorType: "STAFF",
          actorUserId: actor.user.id,
          action: "staff.updated",
          targetType: "user",
          targetId: target.publicId,
          ipAddress: ip,
          metadata: {
            fromRoles: currentRoles,
            ...(input.roles ? { toRoles: input.roles } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
        },
        tx,
      );
      const fresh = await tx.user.findUniqueOrThrow({
        where: { id: target.id },
        include: STAFF_INCLUDE,
      });
      return toStaff(fresh);
    });
  }

  private assertMayGrant(roles: readonly string[], actor: AuthContext): void {
    if (roles.includes("owner") && !actor.roles.includes("owner")) {
      throw new ProblemException(
        403,
        "forbidden",
        "Forbidden",
        "Only an owner can grant or remove the owner role.",
      );
    }
  }
}
