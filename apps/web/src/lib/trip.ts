import type { StaticImageData } from "next/image";
import { dhakaDate } from "@pegah/shared";
import bogaLake from "@/assets/images/hero-boga-lake.jpg";
import coxsBazar from "@/assets/images/coxs-bazar-sunset.jpg";
import nafakhum from "@/assets/images/nafakhum-falls.jpg";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import srimangal from "@/assets/images/srimangal-tea.jpg";
import sundarbans from "@/assets/images/hero-sundarbans-sunrise.jpg";
import tanguar from "@/assets/images/tanguar-houseboat.jpg";

/** Calendar helpers (YYYY-MM-DD, Asia/Dhaka) and search-parameter parsing for stays and tours. */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function dhakaTodayIso(): string {
  const { year, month, day } = dhakaDate();
  return iso(new Date(Date.UTC(year, month, day)));
}

/** Next Thursday for two nights: the start of the Bangladeshi weekend. */
export function defaultStay(): { checkIn: string; checkOut: string } {
  const today = new Date(`${dhakaTodayIso()}T00:00:00Z`);
  const add = (11 - today.getUTCDay()) % 7 || 7;
  const checkIn = addDaysIso(iso(today), add);
  return { checkIn, checkOut: addDaysIso(checkIn, 2) };
}

const int = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export interface StayParams {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
}

/** Reads stay parameters from a URL, falling back to sensible defaults. The API validates again. */
export function parseStayParams(sp: Record<string, string | undefined>): StayParams {
  const d = defaultStay();
  const checkIn = sp.checkIn && ISO.test(sp.checkIn) ? sp.checkIn : d.checkIn;
  let checkOut = sp.checkOut && ISO.test(sp.checkOut) ? sp.checkOut : addDaysIso(checkIn, 2);
  if (checkOut <= checkIn) checkOut = addDaysIso(checkIn, 1);
  const adults = int(sp.adults, 1, 36, 2);
  const rooms = Math.min(int(sp.rooms, 1, 9, 1), adults);
  return { checkIn, checkOut, adults, children: int(sp.children, 0, 18, 0), rooms };
}

export function stayQuery(p: StayParams, extra: Record<string, string> = {}): string {
  return new URLSearchParams({
    ...extra,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    adults: String(p.adults),
    children: String(p.children),
    rooms: String(p.rooms),
  }).toString();
}

export function nightsOf(p: { checkIn: string; checkOut: string }): number {
  return Math.round((Date.parse(p.checkOut) - Date.parse(p.checkIn)) / 86_400_000);
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Common alternative spellings used by travellers. */
const ALIASES: Record<string, string> = {
  sreemangal: "srimangal",
  "cox bazar": "cox s bazar",
  coxs: "cox s bazar",
  sundarban: "sundarbans",
};

/** Finds the destination a free-text "Where to?" refers to. */
export function matchDestination<T extends { slug: string; name: string; region: string }>(
  query: string | undefined,
  destinations: T[],
): T | undefined {
  if (!query) return undefined;
  let q = normalize(query);
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (q.includes(alias)) q = q.replace(alias, canonical);
  }
  return (
    destinations.find((d) => d.slug === query) ??
    destinations.find((d) => {
      const name = normalize(d.name);
      const slug = normalize(d.slug.replace(/-/g, " "));
      return q.includes(name) || q.includes(slug) || name.includes(q) || slug.includes(q);
    })
  );
}

/** Licensed photos (docs/design/IMAGE_CREDITS.md) for listings without their own media yet. */
const PHOTOS: Array<[RegExp, StaticImageData]> = [
  [/srimangal|sreemangal|tea|lawachara/, srimangal],
  [/cox|marine|beach|sea/, coxsBazar],
  [/sundarban|mangrove|cruise/, sundarbans],
  [/bandarban|nilgiri|nafakhum|trek/, nafakhum],
  [/sajek|hill/, sajek],
  [/haor|tanguar|houseboat/, tanguar],
];

export function photoFor(...keys: string[]): StaticImageData {
  const text = keys.join(" ").toLowerCase();
  return PHOTOS.find(([re]) => re.test(text))?.[1] ?? bogaLake;
}
