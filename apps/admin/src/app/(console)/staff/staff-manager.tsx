"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Schemas } from "@pegah/api-client";
import { CreateStaffRequestSchema, STAFF_ROLES, type StaffRole } from "@pegah/contracts";
import { FormAlert, Icon, TextField, buttonClass, cx, zodResolver } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime } from "@/lib/format";

type Staff = Schemas["StaffMemberDto_Output"];
type Role = Schemas["Role_Output"];
type NewStaff = {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  roles: StaffRole[];
};

export function StaffManager({
  staff,
  roles,
  me,
  isOwner,
  csrfToken,
}: {
  staff: Staff[];
  roles: Role[];
  me: string;
  isOwner: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const grantable = STAFF_ROLES.filter((r) => isOwner || r !== "owner");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewStaff>({
    resolver: zodResolver(CreateStaffRequestSchema),
    defaultValues: { roles: ["support"] },
  });

  async function create(values: NewStaff) {
    setError(null);
    setNotice(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/admin/staff", {
      headers: csrf(csrfToken),
      body: { ...values, phone: values.phone || undefined },
    });
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    reset({ roles: ["support"] });
    setNotice(
      `Account created for ${values.email}. Share the initial password privately and ask them to change it.`,
    );
    router.refresh();
  }

  async function update(
    person: Staff,
    body: { roles?: StaffRole[]; status?: "ACTIVE" | "DISABLED" },
  ) {
    setBusyId(person.id);
    setError(null);
    setNotice(null);
    const { error: problem, response } = await browserApi.PATCH("/api/v1/admin/staff/{id}", {
      params: { path: { id: person.id } },
      headers: csrf(csrfToken),
      body,
    });
    setBusyId(null);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    setNotice(`${person.fullName} updated.`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-6">
        {(error || notice) && (
          <FormAlert tone={error ? "critical" : "good"}>{error ?? notice}</FormAlert>
        )}
        <section className="panel overflow-hidden" aria-labelledby="staff-h">
          <h2 id="staff-h" className="px-5 pt-5 text-[0.95rem] font-semibold md:px-6">
            People ({staff.length})
          </h2>
          <ul className="mt-3 divide-y divide-rule">
            {staff.map((p) => {
              const locked = p.roles.includes("owner") && !isOwner;
              const self = p.id === me;
              return (
                <li
                  key={p.id}
                  className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:px-6"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.fullName}
                      {self && (
                        <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.68rem] text-ink-2">
                          you
                        </span>
                      )}
                      {p.status === "DISABLED" && (
                        <span className="rounded-full bg-critical-soft px-2 py-0.5 text-[0.68rem] text-critical">
                          disabled
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[0.82rem] text-ink-2">{p.email}</p>
                    <p className="mt-1 text-[0.76rem] text-ink-3">
                      {p.lastLoginAt
                        ? `Last sign-in ${dhakaDateTime(p.lastLoginAt)}`
                        : "Never signed in"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${p.id}`}>
                      Role for {p.fullName}
                    </label>
                    <select
                      id={`role-${p.id}`}
                      disabled={locked || self || busyId === p.id}
                      value={p.roles[0] ?? ""}
                      onChange={(e) => update(p, { roles: [e.target.value as StaffRole] })}
                      className="h-10 rounded-control border border-rule bg-card px-3 text-[0.84rem] disabled:opacity-60"
                    >
                      {(locked ? STAFF_ROLES : grantable).map((r) => (
                        <option key={r} value={r}>
                          {roleName.get(r) ?? r}
                        </option>
                      ))}
                    </select>
                    {!self && !locked && (
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() =>
                          update(p, { status: p.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })
                        }
                        className={cx(
                          "h-10 rounded-control border px-3 text-[0.82rem] font-semibold",
                          p.status === "ACTIVE"
                            ? "border-rule text-critical hover:border-critical"
                            : "border-rule text-good hover:border-good",
                        )}
                      >
                        {p.status === "ACTIVE" ? "Disable" : "Enable"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-5 md:p-6" aria-labelledby="roles-h">
          <h2 id="roles-h" className="text-[0.95rem] font-semibold">
            Roles
          </h2>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {roles.map((r) => (
              <li key={r.key} className="rounded-[14px] border border-rule p-4">
                <p className="flex items-baseline justify-between gap-2 font-semibold">
                  {r.name}
                  <span className="text-[0.74rem] font-normal text-ink-3">
                    {r.memberCount} member{r.memberCount === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="mt-1 text-[0.82rem] text-ink-2">{r.description}</p>
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {r.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.68rem] font-semibold text-ink-2"
                    >
                      {perm}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <form
        onSubmit={handleSubmit(create)}
        className="panel grid content-start gap-4 p-5 md:p-6"
        aria-labelledby="new-h"
        noValidate
      >
        <h2 id="new-h" className="flex items-center gap-2 text-[0.95rem] font-semibold">
          <Icon name="plus" className="size-4" /> Add a staff member
        </h2>
        <TextField label="Full name" error={errors.fullName?.message} {...register("fullName")} />
        <TextField
          label="Work email"
          type="email"
          autoComplete="off"
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Mobile (optional)"
          placeholder="+8801XXXXXXXXX"
          error={errors.phone?.message}
          {...register("phone", { setValueAs: (v: string) => v.trim() || undefined })}
        />
        <TextField
          label="Initial password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. Share it privately."
          error={errors.password?.message}
          {...register("password")}
        />
        <fieldset className="grid gap-2">
          <legend className="text-[0.84rem] font-semibold">Role</legend>
          {grantable.map((r) => (
            <label key={r} className="flex items-center gap-2 text-[0.88rem]">
              <input
                type="checkbox"
                value={r}
                {...register("roles")}
                className="size-4 accent-[var(--pg-primary)]"
              />
              {roleName.get(r) ?? r}
            </label>
          ))}
          {errors.roles && <p className="text-[0.8rem] text-critical">Choose at least one role.</p>}
        </fieldset>
        <button type="submit" disabled={isSubmitting} className={buttonClass("primary", "md")}>
          {isSubmitting ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
