"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, buttonClass } from "@pegah/ui";
import { addDaysIso, dhakaTodayIso, type StayParams } from "@/lib/trip";

const field =
  "h-12 w-full rounded-control border-[1.5px] border-rule bg-card px-3.5 text-[0.95rem] font-semibold outline-none focus:border-ink";

/** Compact stay search used on results and property pages; submits to /stays. */
export function StaySearchBar({
  where,
  params,
  destinations,
  action = "/stays",
}: {
  where: string;
  params: StayParams;
  destinations: { slug: string; name: string }[];
  /** Property pages re-price in place instead of going back to the list. */
  action?: string;
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const [w, setW] = useState(where);
  const [p, setP] = useState(params);
  const today = dhakaTodayIso();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      ...(action === "/stays" ? { where: w } : {}),
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      adults: String(p.adults),
      children: String(p.children),
      rooms: String(Math.min(p.rooms, p.adults)),
    });
    router.push(`${action}?${q.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="panel grid grid-cols-2 gap-2.5 p-3 shadow-soft md:grid-cols-[1.6fr_1fr_1fr_0.7fr_0.7fr_0.7fr_auto]"
    >
      {action === "/stays" && (
        <label className="col-span-2 grid gap-1 md:col-span-1">
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-2">
            {t("whereTo")}
          </span>
          <select value={w} onChange={(e) => setW(e.target.value)} className={field}>
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="grid gap-1">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-2">
          {t("checkIn")}
        </span>
        <input
          type="date"
          min={today}
          value={p.checkIn}
          onChange={(e) => {
            const checkIn = e.target.value;
            setP((s) => ({
              ...s,
              checkIn,
              checkOut: s.checkOut <= checkIn ? addDaysIso(checkIn, 1) : s.checkOut,
            }));
          }}
          className={field}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-2">
          {t("checkOut")}
        </span>
        <input
          type="date"
          min={addDaysIso(p.checkIn, 1)}
          value={p.checkOut}
          onChange={(e) => setP((s) => ({ ...s, checkOut: e.target.value }))}
          className={field}
        />
      </label>
      {(
        [
          ["adults", t("adults"), 1, 16],
          ["children", t("children"), 0, 10],
          ["rooms", t("rooms"), 1, 8],
        ] as const
      ).map(([key, label, min, max]) => (
        <label key={key} className="grid gap-1">
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-2">
            {label}
          </span>
          <select
            value={p[key]}
            onChange={(e) => setP((s) => ({ ...s, [key]: Number(e.target.value) }))}
            className={field}
          >
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        type="submit"
        className={buttonClass("primary", "md", "col-span-2 h-12 self-end md:col-span-1")}
      >
        <Icon name="search" className="size-[18px]" />
        {action === "/stays" ? t("search") : t("update")}
      </button>
    </form>
  );
}
