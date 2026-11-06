"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Departure = Schemas["AdminDeparture_Output"];

/** Supplier controls for one departure: seats on sale, close or reopen sales. */
export function DepartureControls({
  departure: d,
  csrfToken,
}: {
  departure: Departure;
  csrfToken: string;
}) {
  const t = useTranslations("partner");
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(d.capacity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.PATCH("/api/v1/partner/departures/{id}", {
      params: { path: { id: d.id } },
      headers: csrf(csrfToken),
      body,
    });
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`cap-${d.id}`}>
          {t("departure.seats")}
        </label>
        <input
          id={`cap-${d.id}`}
          type="number"
          min={d.held + d.sold}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="h-9 w-20 rounded-control border border-rule bg-card px-2"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ capacity: Number(capacity) })}
          className="h-9 rounded-control bg-ink px-3 text-[0.8rem] font-semibold text-card"
        >
          {t("departure.save")}
        </button>
        {d.status === "SCHEDULED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: "CLOSED" })}
            className="h-9 rounded-control border border-rule px-3 text-[0.8rem] font-semibold"
          >
            {t("departure.close")}
          </button>
        ) : d.status === "CLOSED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: "SCHEDULED" })}
            className="h-9 rounded-control border border-rule px-3 text-[0.8rem] font-semibold"
          >
            {t("departure.reopen")}
          </button>
        ) : (
          <span className="text-[0.8rem] text-critical">{t("departure.cancelled")}</span>
        )}
      </div>
      {error && <p className="text-[0.78rem] text-critical">{error}</p>}
    </div>
  );
}
