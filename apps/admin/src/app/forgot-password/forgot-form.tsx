"use client";

import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/auth/password-reset/request",
      { body: { email: email.trim() } },
    );
    setBusy(false);
    if (!response.ok) {
      setError(
        response.status === 429
          ? "Too many requests. Wait a minute and try again."
          : problemMessage(problem),
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6">
        <FormAlert tone="good">
          If {email.trim()} has an active account, a reset link is on its way. Check the inbox (and
          spam) within the next few minutes.
        </FormAlert>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
      <TextField
        label="Work email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className={buttonClass("primary", "lg")}
      >
        {busy ? "Sending…" : "Email me a reset link"}
      </button>
    </form>
  );
}
