"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/auth/password-reset/confirm",
      {
        body: { token, newPassword: password },
      },
    );
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-2 grid gap-3">
        <FormAlert tone="good">
          Password changed. For safety, every device was signed out.
        </FormAlert>
        <Link href="/login" className={buttonClass("primary", "md", "h-12 no-underline")}>
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="At least 10 characters."
      />
      <TextField
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || password.length < 10}
        className={buttonClass("primary", "md", "h-12")}
      >
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
