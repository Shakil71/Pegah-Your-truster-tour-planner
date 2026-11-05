"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, SelectField, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { bpsToPercent, percentToBps } from "@/lib/money-input";

type Partner = Schemas["Partner_Output"];
type Product = { slug: string; name: string };
type Note = { tone: "good" | "critical"; text: string } | null;

export function PartnersManager({
  partners,
  hotels,
  tours,
  csrfToken,
}: {
  partners: Partner[];
  hotels: Product[];
  tours: Product[];
  csrfToken: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function run(fn: () => Promise<{ response: Response; error?: unknown }>, ok: string) {
    setNote(null);
    const { response, error } = await fn();
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return false;
    }
    setNote({ tone: "good", text: ok });
    router.refresh();
    return true;
  }

  return (
    <div className="grid gap-6">
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {creating ? (
        <CreatePartner
          onCancel={() => setCreating(false)}
          onSubmit={async (body) => {
            const done = await run(
              () => browserApi.POST("/api/v1/admin/partners", { headers: csrf(csrfToken), body }),
              `${body.name} created. Share the sign-in privately: /partner, ${body.member.email}.`,
            );
            if (done) setCreating(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={buttonClass("primary", "md", "justify-self-start")}
        >
          <Icon name="plus" className="size-[18px]" /> New partner
        </button>
      )}

      {partners.length === 0 && (
        <p className="panel px-6 py-14 text-center text-ink-2">No partners yet.</p>
      )}
      <ul className="grid gap-4">
        {partners.map((p) => (
          <li key={p.id} className="panel overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(openId === p.id ? null : p.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left md:px-6"
              aria-expanded={openId === p.id}
            >
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  {p.name}
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-[0.7rem] font-bold",
                      p.kind === "AGENT" ? "bg-info-soft text-info" : "bg-good-soft text-good",
                    )}
                  >
                    {p.kind === "AGENT" ? "Travel agent" : "Supplier"}
                  </span>
                  {p.status === "SUSPENDED" && (
                    <span className="rounded-full bg-critical-soft px-2 py-0.5 text-[0.7rem] font-bold text-critical">
                      Suspended
                    </span>
                  )}
                </span>
                <span className="text-[0.8rem] text-ink-3">
                  {p.email}
                  {p.kind === "AGENT"
                    ? ` · ${bpsToPercent(p.commissionBps)}% commission`
                    : ` · ${p.hotels.length} hotels, ${p.tours.length} tours`}{" "}
                  · {p.members.length} user{p.members.length === 1 ? "" : "s"}
                </span>
              </span>
              <Icon name={openId === p.id ? "x" : "settings"} className="size-5 text-ink-3" />
            </button>
            {openId === p.id && (
              <PartnerDetail
                partner={p}
                hotels={hotels}
                tours={tours}
                run={run}
                csrfToken={csrfToken}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatePartner({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: Schemas["AdminCreatePartnerDto"]) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"SUPPLIER" | "AGENT">("SUPPLIER");
  const [f, setF] = useState({
    name: "",
    email: "",
    phone: "",
    commission: "10",
    memberName: "",
    memberEmail: "",
    memberPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <form
      className="panel grid gap-4 p-5 md:grid-cols-3 md:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit({
          kind,
          name: f.name,
          email: f.email,
          phone: f.phone.trim() || null,
          commissionBps: kind === "AGENT" ? (percentToBps(f.commission) ?? 0) : 0,
          member: { fullName: f.memberName, email: f.memberEmail, password: f.memberPassword },
        });
        setBusy(false);
      }}
    >
      <h2 className="text-[0.95rem] font-semibold md:col-span-3">New partner</h2>
      <SelectField
        label="Type"
        value={kind}
        onChange={(e) => setKind(e.target.value as typeof kind)}
      >
        <option value="SUPPLIER">Supplier (hotel / tour operator)</option>
        <option value="AGENT">Travel agent</option>
      </SelectField>
      <TextField
        label="Company name"
        value={f.name}
        onChange={(e) => set("name", e.target.value)}
      />
      <TextField
        label="Company email"
        type="email"
        value={f.email}
        onChange={(e) => set("email", e.target.value)}
      />
      <TextField
        label="Phone (optional)"
        placeholder="+8801XXXXXXXXX"
        value={f.phone}
        onChange={(e) => set("phone", e.target.value)}
      />
      {kind === "AGENT" && (
        <TextField
          label="Commission %"
          inputMode="decimal"
          value={f.commission}
          onChange={(e) => set("commission", e.target.value)}
          hint="On the booking total, earned when confirmed."
        />
      )}
      <h3 className="text-[0.86rem] font-semibold md:col-span-3">
        First user (signs in at /partner)
      </h3>
      <TextField
        label="Full name"
        value={f.memberName}
        onChange={(e) => set("memberName", e.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="off"
        value={f.memberEmail}
        onChange={(e) => set("memberEmail", e.target.value)}
      />
      <TextField
        label="Initial password"
        type="password"
        autoComplete="new-password"
        value={f.memberPassword}
        onChange={(e) => set("memberPassword", e.target.value)}
        hint="At least 10 characters; they can change it."
      />
      <div className="flex gap-2 md:col-span-3">
        <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
          {busy ? "Creating…" : "Create partner"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "md")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PartnerDetail({
  partner: p,
  hotels,
  tours,
  run,
  csrfToken,
}: {
  partner: Partner;
  hotels: Product[];
  tours: Product[];
  run: (fn: () => Promise<{ response: Response; error?: unknown }>, ok: string) => Promise<boolean>;
  csrfToken: string;
}) {
  const [f, setF] = useState({
    name: p.name,
    email: p.email,
    phone: p.phone ?? "",
    commission: bpsToPercent(p.commissionBps),
    status: p.status,
  });
  const [hotelSel, setHotelSel] = useState(new Set(p.hotels.map((h) => h.slug)));
  const [tourSel, setTourSel] = useState(new Set(p.tours.map((t) => t.slug)));
  const [member, setMember] = useState({ fullName: "", email: "", password: "" });
  const toggle = (set: Set<string>, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  return (
    <div className="grid gap-6 border-t border-rule px-5 py-5 md:px-6">
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () =>
              browserApi.PUT("/api/v1/admin/partners/{id}", {
                params: { path: { id: p.id } },
                headers: csrf(csrfToken),
                body: {
                  name: f.name,
                  email: f.email,
                  phone: f.phone.trim() || null,
                  commissionBps: p.kind === "AGENT" ? (percentToBps(f.commission) ?? 0) : 0,
                  status: f.status,
                },
              }),
            `${f.name} saved${f.status === "SUSPENDED" ? " and suspended: its users were signed out" : ""}.`,
          );
        }}
      >
        <TextField
          label="Company name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
        <TextField
          label="Email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
        />
        {p.kind === "AGENT" ? (
          <TextField
            label="Commission %"
            value={f.commission}
            onChange={(e) => setF({ ...f, commission: e.target.value })}
          />
        ) : (
          <TextField
            label="Phone"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
        )}
        <SelectField
          label="Status"
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value as typeof f.status })}
        >
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </SelectField>
        <button type="submit" className={buttonClass("ink", "sm", "justify-self-start")}>
          Save company
        </button>
      </form>

      {p.kind === "SUPPLIER" && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                browserApi.PUT("/api/v1/admin/partners/{id}/ownership", {
                  params: { path: { id: p.id } },
                  headers: csrf(csrfToken),
                  body: { hotelSlugs: [...hotelSel], tourSlugs: [...tourSel] },
                }),
              "Assignments saved. The supplier now manages these in the portal.",
            );
          }}
        >
          <h3 className="text-[0.86rem] font-semibold">Hotels and tours this supplier manages</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Hotels", hotels, hotelSel, setHotelSel],
              ["Tours", tours, tourSel, setTourSel],
            ].map(([label, items, sel, setSel]) => (
              <fieldset key={label as string} className="rounded-[12px] border border-rule p-3">
                <legend className="px-1 text-[0.78rem] font-semibold">{label as string}</legend>
                <ul className="grid max-h-56 gap-1 overflow-y-auto">
                  {(items as Product[]).map((it) => (
                    <li key={it.slug}>
                      <label className="flex items-center gap-2 text-[0.86rem]">
                        <input
                          type="checkbox"
                          checked={(sel as Set<string>).has(it.slug)}
                          onChange={() =>
                            (setSel as (s: Set<string>) => void)(
                              toggle(sel as Set<string>, it.slug),
                            )
                          }
                          className="size-4 accent-[var(--pg-primary)]"
                        />
                        {it.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
          </div>
          <button type="submit" className={buttonClass("ink", "sm", "justify-self-start")}>
            Save assignments
          </button>
        </form>
      )}

      <div className="grid gap-3">
        <h3 className="text-[0.86rem] font-semibold">Users</h3>
        <ul className="grid gap-2">
          {p.members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-rule px-3 py-2 text-[0.86rem]"
            >
              <span>
                {m.fullName} <span className="text-ink-3">· {m.email}</span>
                {m.status === "DISABLED" && <span className="ml-2 text-critical">disabled</span>}
              </span>
              <button
                type="button"
                onClick={() =>
                  void run(
                    () =>
                      browserApi.PATCH("/api/v1/admin/partners/{id}/members/{memberId}", {
                        params: { path: { id: p.id, memberId: m.id } },
                        headers: csrf(csrfToken),
                        body: { status: m.status === "ACTIVE" ? "DISABLED" : "ACTIVE" },
                      }),
                    `${m.fullName} ${m.status === "ACTIVE" ? "disabled and signed out" : "enabled"}.`,
                  )
                }
                className={cx(
                  "text-[0.8rem] font-semibold",
                  m.status === "ACTIVE" ? "text-critical" : "text-good",
                )}
              >
                {m.status === "ACTIVE" ? "Disable" : "Enable"}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(
              () =>
                browserApi.POST("/api/v1/admin/partners/{id}/members", {
                  params: { path: { id: p.id } },
                  headers: csrf(csrfToken),
                  body: member,
                }),
              `${member.fullName} added. Share the sign-in privately.`,
            );
            if (ok) setMember({ fullName: "", email: "", password: "" });
          }}
        >
          <TextField
            label="Add user: full name"
            value={member.fullName}
            onChange={(e) => setMember({ ...member, fullName: e.target.value })}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="off"
            value={member.email}
            onChange={(e) => setMember({ ...member, email: e.target.value })}
          />
          <TextField
            label="Initial password"
            type="password"
            autoComplete="new-password"
            value={member.password}
            onChange={(e) => setMember({ ...member, password: e.target.value })}
          />
          <button type="submit" className={buttonClass("outline", "sm", "self-end")}>
            Add user
          </button>
        </form>
      </div>
    </div>
  );
}
