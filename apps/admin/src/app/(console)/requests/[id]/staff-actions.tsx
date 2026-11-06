"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { parseTaka } from "@/lib/money-input";

type Status =
  | "SUBMITTED"
  | "NEEDS_INFO"
  | "QUOTED"
  | "PAID"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";
type Action =
  | "NEEDS_INFO"
  | "QUOTE"
  | "MARK_PAID"
  | "START"
  | "COMPLETE"
  | "REJECT"
  | "CANCEL"
  | "NOTE";

const ALLOWED: Record<Status, Action[]> = {
  SUBMITTED: ["QUOTE", "NEEDS_INFO", "REJECT", "CANCEL", "NOTE"],
  NEEDS_INFO: ["QUOTE", "START", "REJECT", "CANCEL", "NOTE"],
  QUOTED: ["MARK_PAID", "QUOTE", "NEEDS_INFO", "REJECT", "CANCEL", "NOTE"],
  PAID: ["START", "COMPLETE", "NEEDS_INFO", "REJECT", "CANCEL", "NOTE"],
  IN_PROGRESS: ["COMPLETE", "NEEDS_INFO", "REJECT", "CANCEL", "NOTE"],
  COMPLETED: ["NOTE"],
  REJECTED: ["NOTE"],
  CANCELLED: ["NOTE"],
};
const LABEL: Record<Action, string> = {
  QUOTE: "Send price",
  NEEDS_INFO: "Ask customer",
  MARK_PAID: "Record payment",
  START: "Start work",
  COMPLETE: "Complete",
  REJECT: "Reject",
  CANCEL: "Cancel",
  NOTE: "Add note",
};
const HINT: Record<Action, string> = {
  QUOTE: "Total for the whole request. The customer is emailed the price and how to pay.",
  NEEDS_INFO: "Say exactly what is missing (documents, details). The customer is emailed.",
  MARK_PAID: "Only after the money has arrived. Enter the receipt, bKash or bank reference.",
  START: "You are submitting to the embassy or issuing with the airline.",
  COMPLETE: "Visa issued or ticket issued. Upload the e-visa or ticket below first.",
  REJECT: "Explain why. If they paid, arrange the refund and say so.",
  CANCEL: "Explain why. If they paid, arrange the refund and say so.",
  NOTE: "Message to the customer, or tick “internal” to keep it among staff.",
};
const DANGER: Action[] = ["REJECT", "CANCEL"];

/** Staff workflow for one request (ADR-0039): one action at a time, guarded by the current status. */
export function RequestStaffActions({
  id,
  status,
  paid,
  csrfToken,
}: {
  id: string;
  status: Status;
  paid: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const actions = ALLOWED[status].filter((a) => a !== "START" || paid);
  const [action, setAction] = useState<Action>(actions[0]!);
  const [message, setMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("E-visa");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let amountMinor: number | null = null;
    if (action === "QUOTE") {
      amountMinor = parseTaka(amount);
      if (!amountMinor) return setError("Enter the price in taka, e.g. 13000.");
    }
    if (
      DANGER.includes(action) &&
      !window.confirm(`${LABEL[action]} this request? The customer is emailed.`)
    )
      return;
    if (action === "MARK_PAID" && !window.confirm("Confirm the money has been received?")) return;
    setBusy(true);
    const r = await browserApi.POST("/api/v1/admin/requests/{id}/actions", {
      params: { path: { id } },
      headers: csrf(csrfToken),
      body: {
        action,
        expectedStatus: status,
        message,
        ...(amountMinor ? { amount: { amountMinor, currency: "BDT" as const } } : {}),
        ...(action === "MARK_PAID" ? { paymentReference: reference } : {}),
        ...(action === "NOTE" ? { internal } : {}),
      },
    });
    setBusy(false);
    if (!r.response.ok) return setError(problemMessage(r.error));
    setMessage("");
    setAmount("");
    setReference("");
    router.refresh();
  }

  async function upload() {
    const chosen = file.current?.files?.[0];
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/v1/admin/requests/${id}/documents?${new URLSearchParams({ label, name: chosen.name })}`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/octet-stream", ...csrf(csrfToken) },
        body: chosen,
      },
    );
    setBusy(false);
    if (res.status === 413) return setError("The file is too large (up to 5 MB).");
    if (!res.ok) return setError(problemMessage(await res.json().catch(() => null)));
    if (file.current) file.current.value = "";
    router.refresh();
  }

  return (
    <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="act-h">
      <h2 id="act-h" className="text-[0.95rem] font-semibold">
        Next step
      </h2>
      <div role="tablist" aria-label="Action" className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={action === a}
            onClick={() => setAction(a)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold",
              action === a
                ? DANGER.includes(a)
                  ? "border-critical bg-critical-soft text-critical"
                  : "border-primary bg-primary text-on-primary"
                : "border-rule text-ink-2 hover:border-ink hover:text-ink",
            )}
          >
            {LABEL[a]}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <p className="text-[0.8rem] text-ink-3">{HINT[action]}</p>
        {action === "QUOTE" && (
          <TextField
            label="Total price (৳)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        )}
        {action === "MARK_PAID" && (
          <TextField
            label="Payment reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        )}
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          {["QUOTE", "MARK_PAID", "START"].includes(action)
            ? "Message to the customer (optional)"
            : "Message"}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            className="rounded-md border border-rule bg-card px-3 py-2 font-normal"
          />
        </label>
        {action === "NOTE" && (
          <label className="flex items-center gap-2 text-[0.86rem]">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="size-4 accent-[var(--pg-primary)]"
            />
            Internal (staff only, no email)
          </label>
        )}
        {error && <FormAlert>{error}</FormAlert>}
        <button
          type="submit"
          disabled={busy}
          className={buttonClass(
            DANGER.includes(action) ? "outline" : "primary",
            "md",
            "justify-self-start",
          )}
        >
          {busy ? "Saving…" : LABEL[action]}
        </button>
      </form>
      <div className="grid gap-2 border-t border-rule pt-4">
        <p className="text-[0.84rem] font-semibold">
          Add a document for the customer (e-visa, ticket, receipt)
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[0.78rem] font-semibold text-ink-2">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              className="h-9 w-40 rounded-md border border-rule bg-card px-2 text-[0.86rem] text-ink"
            />
          </label>
          <input
            ref={file}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="text-[0.84rem]"
            aria-label="Document file"
          />
          <button
            type="button"
            onClick={upload}
            disabled={busy}
            className={buttonClass("outline", "sm")}
          >
            Upload
          </button>
        </div>
      </div>
    </section>
  );
}
