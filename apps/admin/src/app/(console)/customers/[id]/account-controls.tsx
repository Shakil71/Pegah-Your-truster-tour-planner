"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/**
 * Owner/admin controls for one customer account (customer:manage). Every
 * action is audited; disabling also signs the customer out everywhere.
 * Bookings are never changed here.
 */
export function AccountControls({
  customerId,
  status,
  csrfToken,
}: {
  customerId: string;
  status: "ACTIVE" | "DISABLED";
  csrfToken: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function setStatus(next: "ACTIVE" | "DISABLED") {
    if (next === "DISABLED" && !window.confirm("Disable this account and sign them out?")) return;
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.PATCH("/api/v1/admin/customers/{id}", {
      params: { path: { id: customerId } },
      headers: csrf(csrfToken),
      body: { status: next, ...(reason.trim() ? { reason: reason.trim() } : {}) },
    });
    setBusy(false);
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setReason("");
    setNote({
      tone: "good",
      text: next === "DISABLED" ? "Account disabled and signed out." : "Account enabled.",
    });
    router.refresh();
  }

  async function signOut() {
    setBusy(true);
    setNote(null);
    const { data, error, response } = await browserApi.POST(
      "/api/v1/admin/customers/{id}/sign-out",
      { params: { path: { id: customerId } }, headers: csrf(csrfToken) },
    );
    setBusy(false);
    setNote(
      response.ok && data
        ? { tone: "good", text: `Signed out of ${data.sessionsEnded} session(s).` }
        : { tone: "critical", text: problemMessage(error) },
    );
  }

  return (
    <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="acct-h">
      <div>
        <h2 id="acct-h" className="text-[0.95rem] font-semibold">
          Account controls
        </h2>
        <p className="mt-1 text-[0.84rem] text-ink-2">
          {status === "ACTIVE"
            ? "Disabling blocks sign-in and ends every session at once. Existing bookings stay as they are."
            : "This account is disabled: the customer cannot sign in. Enable it to restore access."}
        </p>
      </div>
      {status === "ACTIVE" && (
        <TextField
          label="Reason (required to disable; kept in the audit log)"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      )}
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        {status === "ACTIVE" ? (
          <button
            type="button"
            disabled={busy || !reason.trim()}
            onClick={() => setStatus("DISABLED")}
            className={buttonClass("outline", "sm", "border-critical text-critical")}
          >
            Disable account
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStatus("ACTIVE")}
            className={buttonClass("primary", "sm")}
          >
            Enable account
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={signOut}
          className={buttonClass("ghost", "sm")}
        >
          Sign out of all devices
        </button>
      </div>
    </section>
  );
}
