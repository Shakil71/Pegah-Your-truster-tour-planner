"use client";

import { useState } from "react";
import { cx } from "@pegah/ui";

/** Local-only toggle until saved items exist in the account API (Phase 4). */
export function WishlistButton({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={`Save ${label}`}
      onClick={() => setSaved((s) => !s)}
      className={cx(
        "absolute right-3 top-3 z-[2] grid size-[38px] cursor-pointer place-items-center rounded-full bg-white/95 transition-colors",
        saved ? "text-[#d9461a]" : "text-[#1c2452]",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
      </svg>
    </button>
  );
}
