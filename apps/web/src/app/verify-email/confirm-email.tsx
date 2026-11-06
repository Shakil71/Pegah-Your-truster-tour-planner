"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, buttonClass } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

export function ConfirmEmail({ token }: { token: string }) {
  const t = useTranslations("verifyEmail");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/auth/verify-email", {
      body: { token },
    });
    if (!response.ok) {
      setState("idle");
      setError(problemMessage(problem));
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <>
        <FormAlert tone="good">{t("done")}</FormAlert>
        <Link href="/account/bookings" className={buttonClass("primary", "md", "no-underline")}>
          {t("toAccount")}
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="text-ink-2">{t("intro")}</p>
      {error && <FormAlert>{error}</FormAlert>}
      <button
        type="button"
        onClick={confirm}
        disabled={state === "busy"}
        className={buttonClass("primary", "md")}
      >
        {state === "busy" ? t("confirming") : t("confirm")}
      </button>
    </>
  );
}
