"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, TextAreaField, TextField, buttonClass } from "@pegah/ui";
import { OrderPill } from "@/components/order-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime, money } from "@/lib/format";

type Card = Schemas["AdminGiftCardListDto_Output"]["items"][number];

const TXN: Record<Card["txns"][number]["kind"], { label: string; sign: string }> = {
  ISSUE: { label: "Issued", sign: "+" },
  REDEEM: { label: "Used", sign: "−" },
  RELEASE: { label: "Returned", sign: "+" },
  VOID: { label: "Voided", sign: "−" },
  REFUND: { label: "Refunded", sign: "+" },
};

export function GiftCardsManager({
  items,
  csrfToken,
  canManage,
}: {
  items: Card[];
  csrfToken: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({ amount: "", name: "", email: "", message: "", reason: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    const amountTaka = Number(form.amount);
    if (!Number.isInteger(amountTaka) || amountTaka < 100) {
      setNote({ tone: "critical", text: "Enter a whole-taka amount of at least ৳100." });
      return;
    }
    setBusy("issue");
    const r = await browserApi.POST("/api/v1/admin/gift-cards", {
      headers: csrf(csrfToken),
      body: {
        amountTaka,
        recipientName: form.name,
        recipientEmail: form.email,
        message: form.message.trim() || undefined,
        reason: form.reason,
      },
    });
    setBusy(null);
    if (!r.response.ok) {
      setNote({ tone: "critical", text: problemMessage(r.error) });
      return;
    }
    setNote({
      tone: "good",
      text: "Gift card issued. The code is being emailed to the recipient.",
    });
    setIssuing(false);
    setForm({ amount: "", name: "", email: "", message: "", reason: "" });
    router.refresh();
  }

  async function voidCard(c: Card) {
    const reason = window.prompt(
      `Why void card •••• ${c.last4}? Its remaining balance ${money(c.balance)} is cancelled.`,
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(c.id);
    setNote(null);
    const r = await browserApi.POST("/api/v1/admin/gift-cards/{id}/void", {
      params: { path: { id: c.id } },
      headers: csrf(csrfToken),
      body: { reason: reason.trim() },
    });
    setBusy(null);
    if (!r.response.ok) return setNote({ tone: "critical", text: problemMessage(r.error) });
    setNote({ tone: "good", text: `Card •••• ${c.last4} voided.` });
    router.refresh();
  }

  async function resend(c: Card) {
    setBusy(c.id);
    setNote(null);
    const r = await browserApi.POST("/api/v1/admin/gift-cards/{id}/resend", {
      params: { path: { id: c.id } },
      headers: csrf(csrfToken),
    });
    setBusy(null);
    if (!r.response.ok) return setNote({ tone: "critical", text: problemMessage(r.error) });
    setNote({ tone: "good", text: `Code email queued again for ${c.recipientEmail}.` });
  }

  const set = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <div className="grid gap-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIssuing((x) => !x)}
            className={buttonClass("primary", "sm")}
          >
            {issuing ? "Close" : "Issue a gift card"}
          </button>
        </div>
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {issuing && (
        <form onSubmit={issue} className="panel grid gap-4 p-5 md:p-6" noValidate>
          <h2 className="text-[1rem] font-semibold">Issue without payment</h2>
          <p className="text-[0.84rem] text-ink-2">
            For compensation, competitions or corporate deals. Recorded in the audit log with your
            name and reason.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Amount (৳, whole taka)" type="number" min={100} {...set("amount")} />
            <TextField
              label="Reason"
              placeholder="Compensation for booking PG-…"
              {...set("reason")}
            />
            <TextField label="Recipient name" {...set("name")} />
            <TextField label="Recipient email" type="email" {...set("email")} />
          </div>
          <TextAreaField label="Message to recipient (optional)" rows={3} {...set("message")} />
          <button
            type="submit"
            disabled={busy === "issue"}
            className={buttonClass("primary", "sm", "justify-self-start")}
          >
            {busy === "issue" ? "Issuing…" : "Issue and email the code"}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="panel p-8 text-center text-ink-2">No gift cards found.</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((c) => (
            <li key={c.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="tabular grid h-12 w-20 place-items-center rounded-[10px] bg-night text-[0.9rem] font-semibold text-on-night">
                  ••{c.last4}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {c.recipientName}{" "}
                    <span className="font-normal text-ink-3">· {c.recipientEmail}</span>
                  </p>
                  <p className="text-[0.82rem] text-ink-3">
                    {c.orderReference ? `Order ${c.orderReference}` : "Issued by staff"} · valid to{" "}
                    {dhakaDateTime(c.expiresAt)}
                  </p>
                </div>
                <p className="tabular text-right">
                  <span className="block font-semibold">{money(c.balance)}</span>
                  <span className="text-[0.76rem] text-ink-3">of {money(c.initial)}</span>
                </p>
                <OrderPill status={c.status} />
                <button
                  type="button"
                  aria-expanded={open === c.id}
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                  className={buttonClass("ghost", "sm")}
                >
                  History
                </button>
                {canManage && c.status === "ACTIVE" && (
                  <>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => resend(c)}
                      className={buttonClass("outline", "sm")}
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => voidCard(c)}
                      className={buttonClass("ghost", "sm")}
                    >
                      Void
                    </button>
                  </>
                )}
              </div>
              {open === c.id && (
                <table className="mt-4 w-full text-left text-[0.82rem]">
                  <caption className="sr-only">Balance history for card ending {c.last4}</caption>
                  <thead>
                    <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                      <th scope="col" className="py-2 font-semibold">
                        When (Dhaka)
                      </th>
                      <th scope="col" className="py-2 font-semibold">
                        What
                      </th>
                      <th scope="col" className="py-2 font-semibold">
                        Note
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Amount
                      </th>
                      <th scope="col" className="py-2 text-right font-semibold">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.txns.map((t, i) => (
                      <tr key={i} className="border-t border-rule">
                        <td className="tabular py-2">{dhakaDateTime(t.at)}</td>
                        <td className="py-2">{TXN[t.kind].label}</td>
                        <td className="py-2 text-ink-2">
                          {[t.bookingReference && `Booking ${t.bookingReference}`, t.note]
                            .filter(Boolean)
                            .join(" · ")}
                        </td>
                        <td className="tabular py-2 text-right">
                          {TXN[t.kind].sign}
                          {money(t.amount)}
                        </td>
                        <td className="tabular py-2 text-right">{money(t.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
