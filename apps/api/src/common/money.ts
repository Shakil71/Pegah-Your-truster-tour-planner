import type { Currency, Money } from "@pegah/contracts";

/**
 * Converts a BIGINT minor-unit amount from the database into the contract
 * shape. Amounts beyond Number.MAX_SAFE_INTEGER (≈ 90 trillion taka) are a
 * data error, not something to round.
 */
export function toMoney(amountMinor: bigint, currency: string): Money {
  if (amountMinor < 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Money amount out of safe range");
  }
  return { amountMinor: Number(amountMinor), currency: currency as Currency };
}
