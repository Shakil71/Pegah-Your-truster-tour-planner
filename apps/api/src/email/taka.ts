/** "2150550" paisa → "৳ 21,505.50" (integer arithmetic; South Asian grouping for BDT). */
export function taka(minor: string, currency: string): string {
  const v = /^\d+$/.test(minor) ? BigInt(minor) : 0n;
  const whole = (v / 100n).toString();
  const frac = (v % 100n).toString().padStart(2, "0");
  const grouped =
    currency === "BDT" && whole.length > 3
      ? `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`
      : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${currency === "BDT" ? "৳" : "$"} ${grouped}${frac === "00" ? "" : `.${frac}`}`;
}
