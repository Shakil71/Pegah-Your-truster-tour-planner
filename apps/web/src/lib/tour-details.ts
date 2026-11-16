import { cleanText } from "./text";

/**
 * Tour texts are free text written in the console or imported from the old
 * website (ADR-0038), e.g.
 *
 *   Day One:
 *   1. Dhaka to Cox's Bazar as per bus ticket schedule
 *   Day 1: Sailing to St. Martin Island
 *   7 AM: The trip will start from Teknaf Jetty.
 *
 *   Cancellation:
 *   • 50% of the tour fee will be refunded if …
 *
 *   Package Duration: 3 Days and 2 night
 *
 * These helpers turn that into days and steps, titled groups of points, and
 * label/value rows so the tour page can lay them out. Nothing is invented:
 * every word shown comes from the text.
 */

/** "• x", "- x", "* x", "1. x", "1) x" */
const POINT = /^(?:[•*·▪●◦–-]|\d{1,2}[.)])\s+/;
const TIME =
  /^(\d{1,2}(?::\d{2})?\s*(?:AM|PM|a\.m\.|p\.m\.))(?:\s*\(?approx\.?\)?)?\s*(?:[:\-–]\s*|\s+(?=[A-Z]))(.+)$/i;
const ROW = /^([^:]{2,32}):(?!\d)\s*(?:[-–]\s*)?(.+)$/;
const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};
const DAY = new RegExp(
  `^(?:#+\\s*)?day[\\s-]*(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})\\b\\s*[:.\\-–]?\\s*(.*)$`,
  "i",
);

function lines(text: string | null | undefined): string[] {
  return cleanText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

const stripPoint = (l: string) => l.replace(POINT, "").trim();
const stripHeading = (l: string) =>
  l
    .replace(/^#+\s*/, "")
    .replace(/\s*[:;]\s*$/, "")
    .trim();
const tidy = (s: string) =>
  s
    .replace(/^\*+\s*/, "")
    .replace(/[\s,;*]+$/, "")
    .trim();
const isLabel = (label: string) => label.split(/\s+/).length <= 5 && !/[.!?]/.test(label);

export type Row = { label: string; value: string };
export type Step = { time: string | null; text: string };
export type Day = { day: number; title: string | null; steps: Step[] };
export type Itinerary = { title: string | null; intro: Row[]; notes: string[]; days: Day[] };

/** Splits an itinerary into days of steps; text before "Day 1" becomes intro rows and notes. */
export function itinerary(text: string | null | undefined): Itinerary {
  const out: Itinerary = { title: null, intro: [], notes: [], days: [] };
  const all = lines(text);
  for (let i = 0; i < all.length; i++) {
    const line = all[i]!;
    // A long line is a day only when written "Day 2: …" (with its colon).
    const day =
      line.length <= 90 || /^(?:#+\s*)?day[\s-]*\w+\s*[:.\-–]/i.test(line) ? DAY.exec(line) : null;
    if (day) {
      const n = /^\d+$/.test(day[1]!) ? Number(day[1]) : NUMBER_WORDS[day[1]!.toLowerCase()]!;
      const rest = stripHeading(day[2] ?? "");
      // "Day 2: After spending the night …" is a step, not a title.
      const long = rest.length > 70;
      out.days.push({
        day: n,
        title: rest && !long ? rest : null,
        steps: long ? [{ time: null, text: rest }] : [],
      });
      continue;
    }
    const current = out.days[out.days.length - 1];
    if (current) {
      const plain = stripPoint(line.replace(/^#+\s*/, ""));
      const time = TIME.exec(plain);
      current.steps.push(
        time
          ? { time: time[1]!.toUpperCase(), text: tidy(time[2]!) }
          : { time: null, text: tidy(plain) },
      );
      continue;
    }
    // Before the first day: "Our Transport Partners:" + next line, a "## Title", or notes.
    if (line.startsWith("#") && !out.title) {
      out.title = stripHeading(line);
    } else if (/:$/.test(line) && line.length <= 60 && all[i + 1] && !DAY.test(all[i + 1]!)) {
      out.intro.push({ label: stripHeading(line), value: stripPoint(all[++i]!) });
    } else {
      const row = ROW.exec(line);
      if (row && isLabel(row[1]!)) out.intro.push({ label: row[1]!.trim(), value: tidy(row[2]!) });
      else out.notes.push(stripPoint(line));
    }
  }
  out.days = out.days.filter((d) => d.title || d.steps.length > 0);
  return out;
}

export type Group = { title: string | null; points: string[]; text: string[] };

/**
 * Titled groups of points: "Cancellation:" / "Refund" headings followed by
 * "• …" lines or sentences. A lone "Travel Tips:" heading that repeats the
 * section name can be dropped with `skipTitle`.
 */
export function groups(text: string | null | undefined, skipTitle?: RegExp): Group[] {
  const all = lines(text);
  const out: Group[] = [];
  let current: Group = { title: null, points: [], text: [] };
  const flush = () => {
    if (current.points.length > 0 || current.text.length > 0) out.push(current);
  };
  for (let i = 0; i < all.length; i++) {
    const line = all[i]!;
    const next = all[i + 1];
    const point = POINT.test(line);
    const heading =
      !point &&
      line.length <= 60 &&
      !/[.!?,]$/.test(line) &&
      (line.startsWith("#") || /[:;]$/.test(line) || (!!next && POINT.test(next)));
    if (heading) {
      const title = stripHeading(line);
      if (
        skipTitle?.test(title) &&
        out.length === 0 &&
        current.title === null &&
        !current.points.length
      ) {
        continue;
      }
      flush();
      current = { title, points: [], text: [] };
    } else if (point) {
      current.points.push(tidy(stripPoint(line)));
    } else if (current.title && line.length <= 240) {
      // Under a heading, each line is one rule ("0–3 years fully free.").
      current.points.push(tidy(line));
    } else {
      current.text.push(line);
    }
  }
  flush();
  return out;
}

export type Block =
  | { type: "row"; label: string; value: string }
  | { type: "heading"; text: string }
  | { type: "points"; items: string[] }
  | { type: "para"; text: string };

/**
 * A description: "Package Duration: 3 days" rows (also "Confirm deadline:"
 * with its value on the next line), short headings ("Food Menu:", "Day 1"),
 * bullet lists and plain paragraphs.
 */
export function describe(text: string | null | undefined): Block[] {
  const all = lines(text).map((l) => l.replace(/^#+\s*/, ""));
  const out: Block[] = [];
  const isPoint = (l: string | undefined) => !!l && POINT.test(l);
  for (let i = 0; i < all.length; i++) {
    const line = all[i]!;
    const next = all[i + 1];
    if (isPoint(line)) {
      const last = out[out.length - 1];
      const item = tidy(stripPoint(line));
      if (last?.type === "points") last.items.push(item);
      else out.push({ type: "points", items: [item] });
      continue;
    }
    const short = line.length <= 40 && !/[.!?,]$/.test(line);
    // "Food Menu:" then "Day 1" then points: both are headings.
    const startsList = (k: number) =>
      isPoint(all[k]) ||
      (!!all[k] && all[k]!.length <= 40 && !/[.!?,]$/.test(all[k]!) && isPoint(all[k + 1]));
    if (short && (isPoint(next) || (/:$/.test(line) && startsList(i + 1)))) {
      out.push({ type: "heading", text: stripHeading(line) });
      continue;
    }
    if (/:$/.test(line) && line.length <= 40 && next && !/:$/.test(next)) {
      out.push({ type: "row", label: stripHeading(line), value: next });
      i++;
      continue;
    }
    const row = ROW.exec(line);
    if (row && isLabel(row[1]!)) {
      out.push({ type: "row", label: row[1]!.trim(), value: tidy(row[2]!) });
    } else {
      out.push({ type: "para", text: line });
    }
  }
  return out;
}

/** "Breakfast: Paratha, Egg" → label and rest, for bold labels inside points. */
export function labelled(point: string): Row | null {
  const row = ROW.exec(point);
  return row && isLabel(row[1]!) ? { label: row[1]!.trim(), value: row[2]!.trim() } : null;
}

/** Plain points from a list-like text ("• AC Bus\n• Cruise Ship"), de-duplicated. */
export function points(text: string | null | undefined): string[] {
  const all = unique(lines(text).map((l) => tidy(stripPoint(l))));
  // "AC BUS" next to "AC Bus (32 seats)" says the same thing twice.
  return all.filter(
    (p) =>
      !all.some(
        (q) => q !== p && q.length > p.length && q.toLowerCase().startsWith(`${p.toLowerCase()} `),
      ),
  );
}

/** Case-insensitive de-duplication, keeping the first spelling. */
export function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Pick-up places (short names) apart from the notes written among them. */
export function pickups(items: string[]): { places: string[]; notes: string[] } {
  const clean = unique(items.map((s) => cleanText(s)));
  return {
    places: clean.filter((s) => s.length <= 48 && !/[.!?]$/.test(s)),
    notes: clean.filter((s) => s.length > 48 || /[.!?]$/.test(s)),
  };
}

/** The "timing" field when it is a clock time ("Starting time at 9:30 pm at Kolabagan", "12:00 PM"). */
export function startTime(timing: string | null | undefined): string | null {
  const t = cleanText(timing);
  if (!/\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(t)) return null;
  return t.replace(/^stating\b/i, "Starting");
}
