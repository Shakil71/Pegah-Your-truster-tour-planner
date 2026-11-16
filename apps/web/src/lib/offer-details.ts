import { cleanText } from "./text";

/**
 * Offer details are free text written in the console (or imported from the
 * old website, ADR-0038), e.g.
 *
 *   📒 Our package includes all the best facilities~
 *   ~Visa with all charges~
 *   Hotel Details~
 *   Makkah Hotel- Rehab Al Bustan or similar
 *   ## Policy
 *   Payment Policy:
 *   Phase-1: 80% at the time of booking.
 *   ## Contact
 *   Dhaka Office
 *   Address: 153/1, Shahali Bag, Mirpur-1, Dhaka
 *
 * These helpers turn it into sections of points, label/value rows and
 * sub-headings so the page can lay it out. Nothing is invented: every value
 * shown comes from the text.
 */

export type SectionKind = "included" | "hotels" | "requirements" | "policy" | "contact" | "other";

export type OfferItem =
  | { type: "point"; text: string }
  | { type: "row"; label: string; value: string }
  | { type: "sub"; text: string };

export type OfferSection = { title: string | null; kind: SectionKind; items: OfferItem[] };

function kindOf(title: string): SectionKind {
  if (/contact|office/i.test(title)) return "contact";
  if (/polic|payment|cancel|refund/i.test(title)) return "policy";
  if (/visa|requirement|document/i.test(title)) return "requirements";
  if (/hotel|accommodation/i.test(title)) return "hotels";
  if (/includ|inclus|facilit|feature/i.test(title)) return "included";
  return "other";
}

/** Strips leading emoji/symbols and the "~" / ":" markers the old site used. */
function tidyTitle(line: string): string {
  return line
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[~:\s]+$/, "")
    .trim();
}

const ROW_COLON = /^([^:]{2,32}):\s+(.+)$/;
/** Contact rows are often written without a space ("Address:Shahalibag"). */
const ROW_CONTACT = /^(address|phone|mobile|tel|e-?mail|whatsapp)\s*:\s*(.+)$/i;
/** Emoji or symbol bullets the old site put before points ("❇️ Hotel", "☑️ Passport"). */
const LEAD_SYMBOLS = /^[^\p{L}\p{N}(“"'+]+/u;
const ROW_DASH = /^([\p{L} ]{3,32}?)\s*[-–]\s+(.+)$/u;

export function offerSections(text: string | null | undefined): OfferSection[] {
  const lines = cleanText(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: OfferSection[] = [];
  let current: OfferSection = { title: null, kind: "other", items: [] };
  const start = (title: string) => {
    if (current.items.length > 0 || current.title) sections.push(current);
    const t = tidyTitle(title);
    current = { title: t, kind: kindOf(t), items: [] };
  };

  for (const line of lines) {
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      start(heading[1]!);
      continue;
    }
    if (line.startsWith("~")) {
      const point = line
        .replace(/^~+\s*/, "")
        .replace(/\s*~+$/, "")
        .replace(LEAD_SYMBOLS, "")
        .trim();
      if (point) current.items.push({ type: "point", text: point });
      continue;
    }
    // "Hotel Details~" opens a section; "Payment Policy:" is a sub-heading.
    if (/~$/.test(line) && line.length <= 120) {
      start(line);
      continue;
    }
    if (/:$/.test(line) && line.length <= 60) {
      current.items.push({ type: "sub", text: tidyTitle(line) });
      continue;
    }
    const row = ROW_CONTACT.exec(line) ?? ROW_COLON.exec(line) ?? ROW_DASH.exec(line);
    if (row) {
      current.items.push({ type: "row", label: row[1]!.trim(), value: row[2]!.trim() });
      continue;
    }
    const point = line.replace(LEAD_SYMBOLS, "").replace(/[.\s]+$/, "");
    if (point) current.items.push({ type: "point", text: point });
  }
  if (current.items.length > 0 || current.title) sections.push(current);

  // Offices written as their own headings ("## Dhaka Office", "## Faridpur
  // Office") become one contact section with a group per office.
  const merged: OfferSection[] = [];
  for (const s of sections) {
    const office = s.kind === "contact" && s.title && !/contact/i.test(s.title);
    const prev = merged[merged.length - 1];
    if (office) {
      const group: OfferItem[] = [{ type: "sub", text: s.title! }, ...s.items];
      if (prev?.kind === "contact") prev.items.push(...group);
      else merged.push({ title: "Contact", kind: "contact", items: group });
    } else {
      merged.push(s);
    }
  }
  sections.splice(0, sections.length, ...merged);

  // A short line right before label/value rows names that group ("Dhaka Office").
  for (const s of sections) {
    s.items = s.items.map((item, i) => {
      const next = s.items[i + 1];
      return item.type === "point" && item.text.length <= 40 && next?.type === "row"
        ? { type: "sub", text: item.text }
        : item;
    });
  }
  return sections.filter((s) => s.items.length > 0);
}

export type OfferFacts = {
  days: number | null;
  /** Nights per city, in the order the text mentions them. */
  nights: Array<{ city: string; count: number }>;
  visa: boolean;
  flights: boolean;
  meals: boolean;
  transport: boolean;
  insurance: boolean;
};

/**
 * Key facts read from the title, summary and the "included" points. A flag
 * is true only when an included point says so.
 */
export function offerFacts(title: string, summary: string, sections: OfferSection[]): OfferFacts {
  const text = `${cleanText(title)} ${cleanText(summary)}`;
  const days = /(\d{1,2})\s*days?\b/i.exec(text);
  const nights = [...text.matchAll(/(\d{1,2})\s*nights?\s+in\s+([A-Z][\p{L}]+)/giu)].map((m) => ({
    count: Number(m[1]),
    city: m[2]!,
  }));
  const included = sections
    .filter((s) => s.kind === "included")
    .flatMap((s) => s.items)
    .map((i) => (i.type === "point" ? i.text : i.type === "row" ? `${i.label} ${i.value}` : ""))
    .join(" \n ");
  return {
    days: days ? Number(days[1]) : null,
    nights: nights.filter((n, i) => nights.findIndex((m) => m.city === n.city) === i),
    visa: /\bvisa\b/i.test(included),
    flights: /air ?tickets?|flights?\b/i.test(included),
    meals: /\bfood\b|meals?\b|breakfast|lunch|dinner/i.test(included),
    transport: /transport|\bbus\b|transfer/i.test(included),
    insurance: /insurance/i.test(included),
  };
}

/** Imported summaries were clipped with "…"; keep only the complete sentences. */
export function wholeSentences(text: string): string {
  const clean = cleanText(text);
  if (!clean.endsWith("…")) return clean;
  const cut = clean.lastIndexOf(". ");
  return cut > 0 ? clean.slice(0, cut + 1) : clean;
}
