/**
 * Text imported from the old website (ADR-0038) still carries HTML entities
 * ("Caf&eacute;") and packs room features into one line joined with "•".
 * These helpers make it readable without trusting it as HTML.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  middot: "·",
  deg: "°",
  times: "×",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  agrave: "à",
  oacute: "ó",
  uacute: "ú",
  iacute: "í",
  ccedil: "ç",
  ntilde: "ñ",
  ouml: "ö",
  uuml: "ü",
  auml: "ä",
};

/** Decodes HTML entities (named, decimal and hex) into plain characters. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

/** Plain, single-spaced text. */
export function cleanText(text: string | null | undefined): string {
  return decodeEntities(text ?? "")
    .replace(/[ \t ]+/g, " ")
    .trim();
}

/** Intro sentences that only announce a list ("…includes the following privileges as follows:"). */
const LIST_INTRO = /(?:below|following)\s+(?:amenities|facilities|privileges|services)|as follows/i;

/** "in room – mini bar, safe box, tv" → the comma list after the dash. */
const DASH_LIST = /^(.{0,40}?)\s+[–—-]\s+(.+,.+,.+)$/;

/**
 * Splits a room or hotel description into short points. Handles the shapes
 * found in old-website text: "• a • b", "** a. ** b.", one item per line,
 * "in room – a, b, c" comma lists, and plain sentences. Intro sentences that
 * only announce a list are dropped, as is a final point cut short by the
 * import ("express…").
 */
export function featureList(text: string | null | undefined): string[] {
  const clean = cleanText(text)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "•");
  if (!clean) return [];

  const bulleted = /•/.test(clean);
  const chunks = bulleted ? clean.split(/\s*•\s*/) : clean.split(/\s*\n+\s*/);
  const items: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    // Text after a "•" is one point already ("Bangla, Indian, Thai cuisine");
    // prose before the first bullet may still hold a comma list.
    const isBullet = bulleted && i > 0;
    for (const sentence of chunk.split(/(?<=[.!?])\s+(?=\S)/)) {
      const s = sentence.trim();
      if (!s || s.endsWith(":") || LIST_INTRO.test(s)) continue;
      const dash = isBullet ? null : DASH_LIST.exec(s);
      const commas = isBullet ? [s] : s.split(/\s*,\s*/);
      if (dash) {
        items.push(...dash[2]!.split(/\s*,\s*/));
      } else if (commas.length >= 4 && commas.every((c) => c.length <= 40)) {
        items.push(...commas);
      } else {
        items.push(s);
      }
    }
  }

  const out = items
    .map((p) =>
      p
        .replace(/^[-–—*\s]+/, "")
        .replace(/\s+etc\.?$/i, "")
        .replace(/[\s.;,]+$/, "")
        .trim(),
    )
    .filter((p) => p.length > 1 && !/^(?:…|\.\.\.)$/.test(p))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
  // A last point cut off by the import ("Express…") reads as a mistake.
  if (out.length > 1 && /…$/.test(out[out.length - 1]!)) out.pop();
  return [...new Set(out)];
}
