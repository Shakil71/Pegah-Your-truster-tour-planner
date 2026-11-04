"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, SelectField, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime, money } from "@/lib/format";
import { bpsToPercent, parseTaka, percentToBps, takaText } from "@/lib/money-input";

type Promotion = Schemas["Promotion_Output"];
type Draft = {
  code: string;
  name: string;
  kind: "PERCENT" | "FIXED";
  percent: string;
  amount: string;
  minSpend: string;
  maxDiscount: string;
  scope: "ALL" | "HOTEL" | "TOUR";
  starts: string;
  ends: string;
  maxRedemptions: string;
  perCustomer: string;
  status: "ACTIVE" | "PAUSED";
};

/** <input type="datetime-local"> value in Dhaka time ↔ ISO instant. */
const toLocal = (iso: string) =>
  new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 16);
const fromLocal = (v: string) => new Date(`${v}:00+06:00`).toISOString();

function draftOf(p?: Promotion): Draft {
  const now = new Date().toISOString();
  return {
    code: p?.code ?? "",
    name: p?.name ?? "",
    kind: p?.kind ?? "PERCENT",
    percent: p?.percentBps ? bpsToPercent(p.percentBps) : "10",
    amount: takaText(p?.amount),
    minSpend: takaText(p?.minSpend) || "0",
    maxDiscount: takaText(p?.maxDiscount),
    scope: p?.scope ?? "ALL",
    starts: toLocal(p?.startsAt ?? now),
    ends: toLocal(p?.endsAt ?? new Date(Date.now() + 30 * 86_400_000).toISOString()),
    maxRedemptions: p?.maxRedemptions ? String(p.maxRedemptions) : "",
    perCustomer: String(p?.perCustomerLimit ?? 1),
    status: p?.status ?? "ACTIVE",
  };
}

export function PromotionsManager({ items, csrfToken }: { items: Promotion[]; csrfToken: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [d, setD] = useState<Draft>(draftOf());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const [now] = useState(() => Date.now());

  function open(p: Promotion | "new") {
    setMessage(null);
    setEditing(p === "new" ? "new" : p.id);
    setD(draftOf(p === "new" ? undefined : p));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const pct = d.kind === "PERCENT" ? percentToBps(d.percent) : null;
    const amt = d.kind === "FIXED" ? parseTaka(d.amount) : null;
    const min = parseTaka(d.minSpend || "0");
    const max = d.maxDiscount.trim() ? parseTaka(d.maxDiscount) : null;
    if (
      (d.kind === "PERCENT" && !pct) ||
      (d.kind === "FIXED" && !amt) ||
      min === null ||
      (d.maxDiscount.trim() && max === null)
    ) {
      setMessage({ tone: "critical", text: "Check the percentage and taka amounts." });
      return;
    }
    const money = (v: number) => ({ amountMinor: v, currency: "BDT" as const });
    const promotion = {
      name: d.name,
      kind: d.kind,
      percentBps: pct,
      amount: amt ? money(amt) : null,
      minSpend: money(min),
      maxDiscount: max ? money(max) : null,
      scope: d.scope,
      startsAt: fromLocal(d.starts),
      endsAt: fromLocal(d.ends),
      maxRedemptions: d.maxRedemptions.trim() ? Number(d.maxRedemptions) : null,
      perCustomerLimit: Number(d.perCustomer),
      status: d.status,
    };
    setBusy(true);
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/admin/promotions", {
            headers: csrf(csrfToken),
            body: { code: d.code, promotion },
          })
        : await browserApi.PUT("/api/v1/admin/promotions/{id}", {
            params: { path: { id: editing! } },
            headers: csrf(csrfToken),
            body: promotion,
          });
    setBusy(false);
    if (!result.response.ok) {
      setMessage({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setEditing(null);
    setMessage({ tone: "good", text: "Promotion saved." });
    router.refresh();
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <div className="grid gap-6">
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      {editing === null ? (
        <button
          type="button"
          onClick={() => open("new")}
          className={buttonClass("primary", "md", "justify-self-start")}
        >
          <Icon name="plus" className="size-[18px]" /> New promotion
        </button>
      ) : (
        <form onSubmit={save} className="panel grid gap-4 p-5 md:grid-cols-4 md:p-6">
          <h2 className="text-[0.95rem] font-semibold md:col-span-4">
            {editing === "new" ? "New promotion" : `Edit ${d.code}`}
          </h2>
          <TextField
            label="Code"
            disabled={editing !== "new"}
            value={d.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            hint="Letters, digits, dashes"
          />
          <TextField
            label="Name (shown to customers)"
            className="md:col-span-2"
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
          />
          <SelectField
            label="Applies to"
            value={d.scope}
            onChange={(e) => set("scope", e.target.value as Draft["scope"])}
          >
            <option value="ALL">Stays and tours</option>
            <option value="HOTEL">Stays only</option>
            <option value="TOUR">Tours only</option>
          </SelectField>
          <SelectField
            label="Type"
            value={d.kind}
            onChange={(e) => set("kind", e.target.value as Draft["kind"])}
          >
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Fixed taka off</option>
          </SelectField>
          {d.kind === "PERCENT" ? (
            <TextField
              label="Percent off"
              inputMode="decimal"
              value={d.percent}
              onChange={(e) => set("percent", e.target.value)}
            />
          ) : (
            <TextField
              label="Amount off (৳)"
              inputMode="decimal"
              value={d.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          )}
          <TextField
            label="Minimum spend (৳, before taxes)"
            inputMode="decimal"
            value={d.minSpend}
            onChange={(e) => set("minSpend", e.target.value)}
          />
          <TextField
            label="Maximum discount (৳, optional)"
            inputMode="decimal"
            value={d.maxDiscount}
            onChange={(e) => set("maxDiscount", e.target.value)}
          />
          <TextField
            label="Starts (Dhaka)"
            type="datetime-local"
            value={d.starts}
            onChange={(e) => set("starts", e.target.value)}
          />
          <TextField
            label="Ends (Dhaka)"
            type="datetime-local"
            value={d.ends}
            onChange={(e) => set("ends", e.target.value)}
          />
          <TextField
            label="Total uses (optional)"
            type="number"
            min={1}
            value={d.maxRedemptions}
            onChange={(e) => set("maxRedemptions", e.target.value)}
          />
          <TextField
            label="Uses per customer"
            type="number"
            min={1}
            value={d.perCustomer}
            onChange={(e) => set("perCustomer", e.target.value)}
          />
          <SelectField
            label="Status"
            value={d.status}
            onChange={(e) => set("status", e.target.value as Draft["status"])}
          >
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </SelectField>
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
              {busy ? "Saving…" : "Save promotion"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={buttonClass("ghost", "md")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="panel overflow-hidden" aria-label="Promotions">
        {items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No promotions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[0.86rem]">
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Offer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Window (Dhaka)
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Used
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Discount given
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const live =
                    p.status === "ACTIVE" &&
                    Date.parse(p.startsAt) <= now &&
                    Date.parse(p.endsAt) > now;
                  return (
                    <tr key={p.id} className="border-t border-rule">
                      <td className="px-4 py-3">
                        <p className="tabular font-semibold">{p.code}</p>
                        <p
                          className={cx(
                            "text-[0.74rem] font-semibold",
                            live ? "text-good" : "text-ink-3",
                          )}
                        >
                          {live
                            ? "Live"
                            : p.status === "PAUSED"
                              ? "Paused"
                              : Date.parse(p.startsAt) > now
                                ? "Scheduled"
                                : "Ended"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{p.name}</p>
                        <p className="text-[0.76rem] text-ink-3">
                          {p.kind === "PERCENT"
                            ? `${bpsToPercent(p.percentBps ?? 0)}% off`
                            : `${p.amount ? money(p.amount) : ""} off`}
                          {p.maxDiscount ? `, max ${money(p.maxDiscount)}` : ""}
                          {p.minSpend.amountMinor ? `, min ${money(p.minSpend)}` : ""} ·{" "}
                          {p.scope === "ALL"
                            ? "stays and tours"
                            : p.scope === "HOTEL"
                              ? "stays"
                              : "tours"}
                        </p>
                      </td>
                      <td className="tabular px-4 py-3 text-[0.8rem]">
                        {dhakaDateTime(p.startsAt)} – {dhakaDateTime(p.endsAt)}
                      </td>
                      <td className="tabular px-4 py-3">
                        {p.redemptions}
                        {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                      </td>
                      <td className="tabular px-4 py-3">{money(p.discountGiven)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => open(p)}
                          className="text-[0.82rem] font-semibold text-primary-ink hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
