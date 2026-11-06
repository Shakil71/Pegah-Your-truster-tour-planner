"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function PartnerLoginForm() {
  const t = useTranslations("partner");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/partner/auth/login", {
      body: { email, password },
    });
    setBusy(false);
    if (!response.ok) {
      setError(
        response.status === 429 ? t("login.tooMany") : problemMessage(problem, t("login.failed")),
      );
      return;
    }
    router.replace("/partner");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <TextField
        label={t("login.email")}
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label={t("login.password")}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !email || !password}
        className={buttonClass("primary", "md", "h-12")}
      >
        {busy ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
