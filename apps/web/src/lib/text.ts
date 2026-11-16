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

/**
 * Splits a feature list ("• a • b • c", or one item per line) into items.
 * Text that is not a list comes back as a single item.
 */
export function featureList(text: string | null | undefined): string[] {
  const clean = cleanText(text);
  if (!clean) return [];
  const parts = /•/.test(clean) ? clean.split(/\s*•\s*/) : clean.split(/\s*\n+\s*/);
  return parts
    .map((p) => p.replace(/^[-–—*\s]+/, "").replace(/[\s.;,]+$/, ""))
    .filter((p) => p.length > 1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}
