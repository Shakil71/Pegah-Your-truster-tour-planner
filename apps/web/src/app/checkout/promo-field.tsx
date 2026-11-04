"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { cx } from "@pegah/ui";

/**
 * Coupon input. Applying re-prices the page on the server (the code goes into
 * the URL and the quote is recomputed); nothing is calculated in the browser.
 */
export function PromoField({
  current,
  applied,
  error,
}: {
  current: string;
  applied: { code: string; name: string } | null;
  error: string | null;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [code, setCode] = useState(current);
  const [pending, start] = useTransition();

  function go(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("promo", value.trim().toUpperCase());
    else next.delete("promo");
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  }

  if (applied) {
    return (
      <p className="mt-4 flex items-center justify-between gap-3 rounded-[12px] bg-good-soft px-3.5 py-2.5 text-[0.86rem] text-good">
        <span>
          <b>{applied.code}</b> applied · {applied.name}
        </span>
        <button type="button" onClick={() => go(null)} className="font-semibold underline">
          Remove
        </button>
      </p>
    );
  }
  return (
    <form
      className="mt-4 grid gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) go(code);
      }}
    >
      <label htmlFor="promo" className="text-[0.84rem] font-semibold">
        Promo code
      </label>
      <div className="flex gap-2">
        <input
          id="promo"
          value={code}
          maxLength={40}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "promo-error" : undefined}
          className="h-11 flex-1 rounded-control border border-rule bg-card px-3 uppercase outline-none focus:border-ink aria-[invalid=true]:border-critical"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className={cx(
            "h-11 rounded-control bg-ink px-4 text-[0.86rem] font-semibold text-card",
            pending && "opacity-60",
          )}
        >
          {pending ? "Checking…" : "Apply"}
        </button>
      </div>
      {error && current && (
        <p id="promo-error" className="text-[0.8rem] text-critical">
          {error}
        </p>
      )}
    </form>
  );
}
