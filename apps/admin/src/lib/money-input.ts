import type { Money } from "@pegah/shared";

/**
 * Taka text → integer paisa, without floating point: "6500", "6,500.5",
 * "6500.50" → 650050. Returns null for anything else.
 */
export function parseTaka(text: string): number | null {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text.replace(/[,\s৳]/g, ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

/** Integer paisa → "6500.50" (for editable inputs). */
export function takaText(m: Money | null | undefined): string {
  if (!m) return "";
  const whole = Math.floor(m.amountMinor / 100);
  const frac = m.amountMinor % 100;
  return frac ? `${whole}.${String(frac).padStart(2, "0")}` : String(whole);
}

/** Basis points ↔ percent text, integer arithmetic ("15" ↔ 1500, "7.5" ↔ 750). */
export function bpsToPercent(bps: number): string {
  return bps % 100 === 0
    ? String(bps / 100)
    : `${Math.floor(bps / 100)}.${String(bps % 100)
        .padStart(2, "0")
        .replace(/0$/, "")}`;
}
export function percentToBps(text: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}
