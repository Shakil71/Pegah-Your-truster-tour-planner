import { randomInt } from "node:crypto";
import { ulid } from "ulid";

/** Public identifier for anything exposed in URLs or to customers. */
export function newPublicId(): string {
  return ulid();
}

// No 0/O, 1/I/L — references are read over the phone.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Human-friendly booking reference, e.g. PG-7K3QX9. Uniqueness is enforced by the DB. */
export function newBookingReference(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `PG-${out}`;
}
