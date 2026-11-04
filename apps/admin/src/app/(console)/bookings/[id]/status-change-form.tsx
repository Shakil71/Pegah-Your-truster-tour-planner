"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingStatus } from "@pegah/contracts";
import { FormAlert, SelectField, TextAreaField, buttonClass } from "@pegah/ui";
import { statusMeta } from "@/components/status-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/**
 * Manual status change. The options are the edges the API's state machine
 * allows for staff right now; the API validates again, checks the expected
 * status (optimistic concurrency) and writes history + audit atomically.
 */
export function StatusChangeForm({
  bookingId,
  current,
  allowed,
  csrfToken,
}: {
  bookingId: string;
  current: BookingStatus;
  allowed: BookingStatus[];
  csrfToken: string;
}) {
  const router = useRouter();
  const [to, setTo] = useState<BookingStatus | "">(allowed[0] ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (allowed.length === 0) {
    return (
      <section className="panel p-5 text-[0.86rem] text-ink-2 md:p-6">
        <h2 className="text-[0.95rem] font-semibold text-ink">Change status</h2>
        <p className="mt-2">
          No manual changes are possible from {statusMeta[current].label}. The system moves this
          booking on (payment, expiry) or it is final.
        </p>
      </section>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return;
    if (reason.trim().length < 5) {
      setError("Give a reason of at least 5 characters; it is kept in the audit log.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/admin/bookings/{id}/status",
      {
        params: { path: { id: bookingId } },
        headers: csrf(csrfToken),
        body: { to, reason: reason.trim(), expectedStatus: current },
      },
    );
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      if (response.status === 409) router.refresh();
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel grid gap-4 p-5 md:p-6" aria-labelledby="chg-h">
      <h2 id="chg-h" className="text-[0.95rem] font-semibold">
        Change status
      </h2>
      <SelectField
        label="New status"
        value={to}
        onChange={(e) => setTo(e.target.value as BookingStatus)}
      >
        {allowed.map((s) => (
          <option key={s} value={s}>
            {statusMeta[s].label}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Reason (audited)"
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        hint="Who you spoke to and what was agreed. Visible in the audit log."
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button type="submit" disabled={busy} className={buttonClass("ink", "md")}>
        {busy ? "Saving…" : `Move to ${to ? statusMeta[to].label : "…"}`}
      </button>
      <p className="text-[0.76rem] text-ink-3">
        Confirmation is allowed only from manual review, after you have checked payment and supplier
        confirmation.
      </p>
    </form>
  );
}
