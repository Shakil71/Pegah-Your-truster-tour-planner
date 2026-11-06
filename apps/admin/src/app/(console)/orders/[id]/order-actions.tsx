"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/** Record an offline payment, or cancel an unpaid order (ADR-0032). */
export function OrderActions({ id, csrfToken }: { id: string; csrfToken: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markPaid(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "Confirm you have received this money? The customer is emailed and a gift card is issued if this is a gift card order.",
      )
    )
      return;
    setBusy("pay");
    setError(null);
    const r = await browserApi.POST("/api/v1/admin/orders/{id}/mark-paid", {
      params: { path: { id } },
      headers: csrf(csrfToken),
      body: { reference },
    });
    setBusy(null);
    if (!r.response.ok) return setError(problemMessage(r.error));
    router.refresh();
  }

  async function cancel(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("Cancel this order? Any reserved offer packages are released.")) return;
    setBusy("cancel");
    setError(null);
    const r = await browserApi.POST("/api/v1/admin/orders/{id}/cancel", {
      params: { path: { id } },
      headers: csrf(csrfToken),
      body: { reason },
    });
    setBusy(null);
    if (!r.response.ok) return setError(problemMessage(r.error));
    router.refresh();
  }

  return (
    <>
      {error && <FormAlert>{error}</FormAlert>}
      <form onSubmit={markPaid} className="panel grid gap-3 p-5">
        <h2 className="text-[0.96rem] font-semibold">Mark as paid</h2>
        <p className="text-[0.82rem] text-ink-2">
          Only after the money is in Pegah&apos;s account. Write how it was paid.
        </p>
        <TextField
          label="Payment reference"
          placeholder="bKash TrxID 8N7K2Q…"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
          minLength={3}
        />
        <button
          type="submit"
          disabled={busy !== null || reference.trim().length < 3}
          className={buttonClass("primary", "sm")}
        >
          {busy === "pay" ? "Saving…" : "Mark as paid"}
        </button>
      </form>
      <form onSubmit={cancel} className="panel grid gap-3 p-5">
        <h2 className="text-[0.96rem] font-semibold">Cancel order</h2>
        <TextField
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
        />
        <button
          type="submit"
          disabled={busy !== null || reason.trim().length < 3}
          className={buttonClass("outline", "sm")}
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel order"}
        </button>
      </form>
    </>
  );
}
