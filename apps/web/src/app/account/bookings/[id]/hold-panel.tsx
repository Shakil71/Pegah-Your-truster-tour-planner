"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormAlert, Icon } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

function remaining(until: string): number {
  return Math.max(0, Math.floor((Date.parse(until) - Date.now()) / 1000));
}

/** Countdown for a held booking, plus cancel. Payment arrives in the next release. */
export function HoldPanel({
  bookingId,
  holdExpiresAt,
  csrfToken,
}: {
  bookingId: string;
  holdExpiresAt: string;
  csrfToken: string;
}) {
  const router = useRouter();
  // Server and client clocks differ by a few seconds; the text opts out of hydration checks.
  const [left, setLeft] = useState<number>(() => remaining(holdExpiresAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const s = remaining(holdExpiresAt);
      setLeft(s);
      // The server expires the hold within a minute; then show the new status.
      if (s === 0) setTimeout(() => router.refresh(), 70_000);
      if (s === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [holdExpiresAt, router]);

  async function cancel() {
    if (!window.confirm("Cancel this hold and release the room or seats?")) return;
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/me/bookings/{id}/cancel", {
      params: { path: { id: bookingId } },
      headers: csrf(csrfToken),
      body: {},
    });
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <section className="relative overflow-hidden rounded-card bg-night p-6 text-white md:p-8">
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 size-[280px] rounded-full bg-[radial-gradient(circle,rgb(255_133_47/0.4),transparent_65%)]"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
            Held for you
          </p>
          <p
            className="tabular mt-1 font-display text-[3rem] font-medium leading-none"
            aria-live="off"
            suppressHydrationWarning
          >
            {mm}:{ss}
          </p>
          <p className="mt-2 max-w-[48ch] text-white/75">
            {left === 0
              ? "The hold has ended. The room or seats go back on sale within a minute."
              : "Online payment opens in the next release. Until then this hold is not a confirmed booking and is released automatically when the timer ends."}
          </p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center gap-2 rounded-control bg-primary px-5 font-semibold text-on-primary opacity-50"
          >
            <Icon name="card" className="size-[18px]" /> Pay now · coming soon
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy || left === 0}
            className="h-11 rounded-control border-[1.5px] border-white/70 px-5 font-semibold text-white hover:bg-white hover:text-night disabled:opacity-40"
          >
            {busy ? "Cancelling…" : "Cancel hold"}
          </button>
        </div>
      </div>
      {error && (
        <div className="relative mt-4">
          <FormAlert>{error}</FormAlert>
        </div>
      )}
    </section>
  );
}
