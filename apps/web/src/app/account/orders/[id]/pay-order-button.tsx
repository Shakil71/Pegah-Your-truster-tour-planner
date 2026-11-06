"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, Icon } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/** Opens the hosted payment page for an order; card details never touch Pegah. */
export function PayOrderButton({ orderId, csrfToken }: { orderId: string; csrfToken: string }) {
  const t = useTranslations("orders");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    const {
      data,
      error: problem,
      response,
    } = await browserApi.POST("/api/v1/me/orders/{id}/payment-session", {
      params: { path: { id: orderId } },
      headers: csrf(csrfToken),
    });
    if (!response.ok || !data) {
      setBusy(false);
      setError(problemMessage(problem));
      return;
    }
    window.location.assign(data.redirectUrl);
  }

  return (
    <div className="mt-4 grid gap-3">
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="inline-flex h-11 items-center justify-center gap-2 justify-self-start rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
      >
        <Icon name="card" className="size-[18px]" />
        {busy ? t("opening") : t("payNow")}
      </button>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  );
}
