/**
 * Idempotently writes permissions and system roles to the database from the
 * definitions in code (packages/contracts PERMISSIONS + ROLE_DEFAULTS).
 *   npm run seed:rbac -w @pegah/api
 */
import { PERMISSIONS, PERMISSION_KEYS, STAFF_ROLES } from "@pegah/contracts";
import { ROLE_DEFAULTS } from "../rbac/role-defaults";
import { cliDb, run } from "./cli-db";

const db = cliDb();

void run(async () => {
  await db.$transaction(async (tx) => {
    for (const key of PERMISSION_KEYS) {
      await tx.permission.upsert({
        where: { key },
        create: { key, description: PERMISSIONS[key] },
        update: { description: PERMISSIONS[key] },
      });
    }
    const permissionIds = new Map(
      (await tx.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]),
    );

    for (const key of STAFF_ROLES) {
      const def = ROLE_DEFAULTS[key];
      const role = await tx.role.upsert({
        where: { key },
        create: { key, name: def.name, description: def.description, isSystem: true },
        update: { name: def.name, description: def.description, isSystem: true },
      });
      // System roles mirror the code exactly: add missing grants, drop extras.
      const wanted = def.permissions.map((p) => permissionIds.get(p)!);
      await tx.rolePermission.deleteMany({
        where: { roleId: role.id, permissionId: { notIn: wanted } },
      });
      await tx.rolePermission.createMany({
        data: wanted.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
      console.warn(`role ${key}: ${wanted.length} permissions`);
    }
  });
  console.warn("RBAC seed complete.");
}, db);
