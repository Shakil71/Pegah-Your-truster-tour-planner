"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/auth/password-reset/request",
      { body: { email } },
    );
    setBusy(false);
    if (!response.ok) {
      setError(response.status === 429 ? t("tooManyRequests") : problemMessage(problem));
      return;
    }
    setDone(true);
  }

  if (done) {
    return <FormAlert tone="good">{t("resetSent", { email })}</FormAlert>;
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !email}
        className={buttonClass("primary", "md", "h-12")}
      >
        {busy ? t("sending") : t("sendLink")}
      </button>
    </form>
  );
}
