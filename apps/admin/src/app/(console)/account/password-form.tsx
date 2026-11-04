"use client";

import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/** Change your own staff password. Other devices are signed out; this one stays signed in. */
export function StaffPasswordForm({ csrfToken }: { csrfToken: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) {
      setNote({ tone: "critical", text: "The new passwords do not match." });
      return;
    }
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.POST("/api/v1/staff/auth/password", {
      headers: csrf(csrfToken),
      body: { currentPassword: current, newPassword: next },
    });
    setBusy(false);
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setCurrent("");
    setNext("");
    setRepeat("");
    setNote({ tone: "good", text: "Password changed. Other devices were signed out." });
  }

  return (
    <form onSubmit={submit} className="panel grid gap-4 p-5 md:p-6">
      <h2 className="text-[0.95rem] font-semibold">Change password</h2>
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="At least 10 characters. A short sentence works well."
      />
      <TextField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
      />
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !current || next.length < 10}
        className={buttonClass("primary", "md", "justify-self-start")}
      >
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
