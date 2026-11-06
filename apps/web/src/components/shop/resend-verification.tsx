"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

export function ResendVerification({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations("verifyEmail");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("busy");
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/me/email-verification", {
      headers: csrf(csrfToken),
    });
    if (!response.ok) {
      setState("idle");
      setError(problemMessage(problem));
      return;
    }
    setState("sent");
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={resend}
        disabled={state !== "idle"}
        className="rounded-full border-[1.5px] border-ink px-4 py-1.5 text-[0.84rem] font-semibold hover:bg-ink hover:text-card disabled:opacity-60"
      >
        {state === "sent" ? t("sent") : state === "busy" ? t("sending") : t("resend")}
      </button>
      {error && (
        <p role="alert" className="text-[0.8rem] text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
