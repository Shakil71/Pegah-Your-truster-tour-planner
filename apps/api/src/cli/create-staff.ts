/**
 * Creates (or re-roles) a staff user. The password is never taken from the
 * command line (it would land in shell history and `ps`): it is read from a
 * hidden prompt, or from PEGAH_STAFF_PASSWORD for non-interactive use.
 *
 *   npm run staff:create -w @pegah/api -- --email owner@example.com --name "Full Name" --role owner
 */
import { EmailSchema, PasswordSchema, StaffRoleSchema } from "@pegah/contracts";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { PasswordService } from "../auth/password.service";
import { newPublicId } from "../common/ids";
import { EnvSchema, type AppConfig } from "../config/config";
import { arg, cliDb, run } from "./cli-db";

function promptHidden(question: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

const db = cliDb();

void run(async () => {
  const email = EmailSchema.parse(arg("email"));
  const fullName = (arg("name") ?? "").trim();
  if (fullName.length < 2) throw new Error("--name is required");
  const role = StaffRoleSchema.parse(arg("role"));

  const roleRow = await db.role.findUnique({ where: { key: role } });
  if (!roleRow) throw new Error(`Role "${role}" not found. Run seed:rbac first.`);

  const existing = await db.user.findUnique({ where: { email } });
  let passwordHash = existing?.passwordHash;
  if (!existing) {
    const password =
      process.env.PEGAH_STAFF_PASSWORD ?? (await promptHidden("Password (min 10 chars): "));
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) throw new Error("Password must be 10–128 characters.");
    // Same Argon2id cost settings as the API, so logins do not trigger a rehash.
    const costs = EnvSchema.pick({
      ARGON2_MEMORY_KIB: true,
      ARGON2_TIME_COST: true,
      ARGON2_PARALLELISM: true,
    }).parse(process.env);
    passwordHash = await new PasswordService(costs as AppConfig).hash(parsed.data);
  }

  await db.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data: { kind: "STAFF", fullName } })
      : await tx.user.create({
          data: {
            publicId: newPublicId(),
            email,
            fullName,
            passwordHash: passwordHash!,
            kind: "STAFF",
          },
        });
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleRow.id } },
      create: { userId: user.id, roleId: roleRow.id },
      update: {},
    });
    await tx.auditEvent.create({
      data: {
        actorType: "SYSTEM",
        action: existing ? "user.role_granted" : "user.staff_created",
        targetType: "user",
        targetId: user.publicId,
        metadata: { role, via: "cli" },
      },
    });
  });
  console.warn(`${existing ? "Updated" : "Created"} staff user ${email} with role ${role}.`);
}, db);
