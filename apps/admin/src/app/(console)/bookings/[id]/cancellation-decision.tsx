"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextAreaField, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { parseTaka, takaText } from "@/lib/money-input";

/**
 * Decide a customer's cancellation request. Approving cancels the booking,
 * puts its rooms/seats back on sale and (if a refund is entered) opens a
 * refund for finance. The API caps the refund at what was paid.
 */
export function CancellationDecision({
  bookingId,
  paid,
  policy,
  csrfToken,
}: {
  bookingId: string;
  paid: { amountMinor: number; currency: "BDT" | "USD" };
  policy: string | null;
  csrfToken: string;
}) {
  const router = useRouter();
  const [approve, setApprove] = useState(true);
  const [refund, setRefund] = useState(takaText(paid));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const refundMinor = approve && refund.trim() ? parseTaka(refund) : 0;
    if (refundMinor === null) {
      setError("Enter the refund in taka, e.g. 10500 or 0.");
      return;
    }
    setBusy(true);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/admin/bookings/{id}/cancellation-decision",
      {
        params: { path: { id: bookingId } },
        headers: csrf(csrfToken),
        body: {
          approve,
          ...(approve && refundMinor > 0
            ? { refund: { amountMinor: refundMinor, currency: paid.currency } }
            : {}),
          reason,
          expectedStatus: "CANCELLATION_REQUESTED",
        },
      },
    );
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="panel grid gap-4 border-warn/50 p-5 md:p-6"
      aria-labelledby="cx-h"
    >
      <h2 id="cx-h" className="text-[0.95rem] font-semibold">
        Cancellation request
      </h2>
      {policy && <p className="text-[0.82rem] text-ink-2">Policy: {policy}</p>}
      <div
        className="flex rounded-full border border-rule bg-paper p-1"
        role="group"
        aria-label="Decision"
      >
        {[
          [true, "Approve and cancel"],
          [false, "Reject, keep booking"],
        ].map(([value, label]) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={approve === value}
            onClick={() => setApprove(value as boolean)}
            className={cx(
              "flex-1 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold",
              approve === value ? "bg-ink text-card" : "text-ink-2",
            )}
          >
            {label as string}
          </button>
        ))}
      </div>
      {approve && (
        <TextField
          label={`Refund (৳), max ${takaText(paid)}`}
          inputMode="decimal"
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          hint="0 when the policy gives no refund. Finance pays it from the Refunds page."
        />
      )}
      <TextAreaField
        label="Reason (sent to the customer, audited)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || reason.trim().length < 5}
        className={buttonClass(approve ? "primary" : "ink", "md")}
      >
        {busy ? "Saving…" : approve ? "Cancel booking" : "Reject request"}
      </button>
    </form>
  );
}
