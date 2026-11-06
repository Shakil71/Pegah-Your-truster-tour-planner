/**
 * Reads a phpMyAdmin / mysqldump SQL file (the old Pegah website, ADR-0038)
 * into plain objects without executing any SQL. Only `INSERT INTO … VALUES`
 * statements are read; every value is kept as the original string (or null).
 */
export type DumpRow = Record<string, string | null>;
export type Dump = Record<string, DumpRow[]>;

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", Z: "\x1a" };

function readTuple(src: string, start: number): [Array<string | null>, number] {
  const values: Array<string | null> = [];
  let i = start + 1; // past "("
  for (;;) {
    while (src[i] === " " || src[i] === "\n" || src[i] === "\r" || src[i] === "\t") i++;
    if (src[i] === "'") {
      let out = "";
      i++;
      for (;;) {
        const c = src[i];
        if (c === undefined) throw new Error("Unterminated string in dump");
        if (c === "\\") {
          const n = src[i + 1]!;
          out += ESCAPES[n] ?? n;
          i += 2;
        } else if (c === "'" && src[i + 1] === "'") {
          out += "'";
          i += 2;
        } else if (c === "'") {
          i++;
          break;
        } else {
          out += c;
          i++;
        }
      }
      values.push(out);
    } else {
      let j = i;
      while (j < src.length && src[j] !== "," && src[j] !== ")") j++;
      const raw = src.slice(i, j).trim();
      values.push(raw.toUpperCase() === "NULL" ? null : raw);
      i = j;
    }
    while (src[i] === " ") i++;
    if (src[i] === ",") {
      i++;
      continue;
    }
    if (src[i] === ")") return [values, i + 1];
    throw new Error(`Unexpected character in dump at offset ${i}`);
  }
}

export function parseDump(sql: string): Dump {
  const dump: Dump = {};
  const insert = /INSERT INTO `([^`]+)` \(([^)]*)\) VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = insert.exec(sql))) {
    const table = m[1]!;
    const columns = m[2]!.split(",").map((c) => c.trim().replace(/`/g, ""));
    const rows = (dump[table] ??= []);
    let i = insert.lastIndex;
    for (;;) {
      while (/\s/.test(sql[i] ?? "")) i++;
      if (sql[i] !== "(") throw new Error(`Expected a row for ${table} at offset ${i}`);
      const [values, next] = readTuple(sql, i);
      if (values.length !== columns.length) {
        throw new Error(`${table}: row has ${values.length} values for ${columns.length} columns`);
      }
      rows.push(Object.fromEntries(columns.map((c, k) => [c, values[k] ?? null])));
      i = next;
      while (/\s/.test(sql[i] ?? "")) i++;
      if (sql[i] === ",") {
        i++;
        continue;
      }
      if (sql[i] === ";") break;
      throw new Error(`Expected , or ; after a ${table} row at offset ${i}`);
    }
    insert.lastIndex = i;
  }
  return dump;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  bull: "•",
  times: "×",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

/**
 * Rich text from the old CMS → plain text with blank-line paragraphs, "## "
 * headings and "• " bullets (the format the new site renders; never raw HTML).
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html.replace(/\r/g, "");
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    (_, t: string) => `\n\n## ${t.replace(/<[^>]+>/g, "").trim()}\n\n`,
  );
  s = s.replace(/<li[^>]*>/gi, "\n• ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|ul|ol|table|tr|blockquote)>/gi, "\n\n");
  s = s.replace(/<\/(td|th)>/gi, " ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  // Consecutive list items stay on adjacent lines.
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(/^(• [^\n]*)\n\n(?=• )/gm, "$1\n");
  }
  return s.trim();
}

/** The "• " items of a list in rich text (falls back to non-empty lines). */
export function htmlToList(html: string | null | undefined): string[] {
  const text = htmlToText(html);
  if (!text) return [];
  const bullets = text
    .split("\n")
    .filter((l) => l.startsWith("• "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);
  if (bullets.length > 0) return bullets;
  return text
    .split("\n")
    .map((l) => l.replace(/^## /, "").trim())
    .filter(Boolean);
}

/** Shortens text at a word boundary to at most `max` characters. */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

export function slugify(s: string, max = 80): string {
  return (
    decodeEntities(s)
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "item"
  );
}

/** "2:00 PM", "13:00", "12:30" → "HH:MM"; null when unreadable. */
export function toHhMm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ap = m[3]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** "4500.00" / "৳ 1,200" / "from 140000 BDT" → paisa (BigInt); null when there is no number. */
export function takaToMinor(raw: string | null | undefined): bigint | null {
  if (!raw) return null;
  const m = /(\d[\d,]*)(?:\.(\d{1,2}))?/.exec(raw);
  if (!m) return null;
  const whole = BigInt(m[1]!.replace(/,/g, ""));
  const frac = BigInt((m[2] ?? "0").padEnd(2, "0"));
  return whole * 100n + frac;
}

/** The src of a Google Maps <iframe>, or the URL itself. Only http(s) URLs are kept. */
export function mapUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const src = /src=["']([^"']+)["']/i.exec(raw)?.[1] ?? raw.trim();
  return /^https?:\/\//i.test(src) ? decodeEntities(src) : null;
}

/** Positive integer from a messy field ("12 people", "5"), else null. */
export function int(raw: string | null | undefined, max = 65535): number | null {
  const m = /\d+/.exec(raw ?? "");
  if (!m) return null;
  const n = Number(m[0]);
  return n > 0 && n <= max ? n : null;
}

/** Old timestamps were written in Dhaka local time without a zone. */
export function dhakaToUtc(raw: string | null | undefined): Date | null {
  if (!raw || raw.startsWith("0000")) return null;
  const d = new Date(`${raw.replace(" ", "T")}+06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
