"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, TextAreaField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/** Lets a customer ask to cancel a confirmed booking; staff decide under the policy. */
export function CancellationRequest({
  bookingId,
  policy,
  csrfToken,
}: {
  bookingId: string;
  policy: string | null;
  csrfToken: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useTranslations("trip");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[0.9rem] font-semibold text-critical"
      >
        {t("requestCancellation")}
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST(
      "/api/v1/me/bookings/{id}/cancellation-request",
      {
        params: { path: { id: bookingId } },
        headers: csrf(csrfToken),
        body: { reason },
      },
    );
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel grid gap-3 p-5">
      <h2 className="text-[1rem] font-semibold">{t("requestCancellation")}</h2>
      {policy && <p className="text-[0.86rem] text-ink-2">Policy: {policy}</p>}
      <TextAreaField
        label={t("whyCancel")}
        value={reason}
        minLength={5}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        hint={t("cancelHint")}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || reason.trim().length < 5}
          className={buttonClass("ink", "sm")}
        >
          {busy ? t("sending") : t("sendRequest")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Keep my booking
        </button>
      </div>
    </form>
  );
}
