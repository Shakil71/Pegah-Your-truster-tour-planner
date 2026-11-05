"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const t = useTranslations("auth");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("mismatch"));
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
        <FormAlert tone="good">{t("passwordChangedAll")}</FormAlert>
        <Link href="/login" className={buttonClass("primary", "md", "h-12 no-underline")}>
          {t("signIn")}
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      <TextField
        label={t("newPassword")}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={t("tenChars")}
      />
      <TextField
        label={t("repeatPassword")}
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
        {busy ? t("saving") : t("savePassword")}
      </button>
    </form>
  );
}
