import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, it } from "vitest";

/*
 * Guards the website translations (ADR-0028): both languages have exactly the
 * same keys, every message is valid ICU syntax, and every key the code uses
 * exists. A missing key would otherwise show up as raw text in production.
 */
const root = resolve(__dirname, "../..");
type Tree = { [key: string]: string | Tree };
const load = (locale: string) =>
  JSON.parse(readFileSync(join(root, "messages", `${locale}.json`), "utf8")) as Tree;
const en = load("en");
const bn = load("bn");

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}
const flatEn = flatten(en);
const flatBn = flatten(bn);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Keys the code asks for: `t("key")`, `t.rich("key")`, with the namespace of each `t`. */
function usedKeys(): { key: string; file: string; prefixOnly: boolean }[] {
  const used: { key: string; file: string; prefixOnly: boolean }[] = [];
  for (const file of sourceFiles(join(root, "src"))) {
    const text = readFileSync(file, "utf8");
    const bindings = new Map<string, string>();
    for (const m of text.matchAll(
      /const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([\w.]+)"\)/g,
    )) {
      bindings.set(m[1]!, m[2]!);
    }
    for (const m of text.matchAll(/\(await getTranslations\("([\w.]+)"\)\)\("([\w.]+)"/g)) {
      used.push({ key: `${m[1]}.${m[2]}`, file, prefixOnly: false });
    }
    for (const [name, ns] of bindings) {
      const call = new RegExp(`\\b${name}(?:\\.rich)?\\(\\s*(["\`])([\\w.]+)(\\$\\{)?`, "g");
      for (const m of text.matchAll(call)) {
        const dynamic = m[1] === "`" && m[3] === "${";
        used.push({ key: `${ns}.${m[2]}`, file, prefixOnly: dynamic });
      }
    }
  }
  return used;
}

describe("website translations", () => {
  it("have the same keys in English and Bangla", () => {
    const onlyEn = [...flatEn.keys()].filter((k) => !flatBn.has(k));
    const onlyBn = [...flatBn.keys()].filter((k) => !flatEn.has(k));
    expect({ onlyEn, onlyBn }).toEqual({ onlyEn: [], onlyBn: [] });
  });

  it("are valid ICU messages", () => {
    const broken: string[] = [];
    for (const [locale, flat] of [
      ["en", flatEn],
      ["bn", flatBn],
    ] as const) {
      for (const [key, message] of flat) {
        try {
          new IntlMessageFormat(message, locale);
        } catch (error) {
          broken.push(`${locale}:${key}: ${(error as Error).message}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("cover every key the code uses", () => {
    const missing = usedKeys()
      .filter(({ key, prefixOnly }) =>
        prefixOnly ? ![...flatEn.keys()].some((k) => k.startsWith(key)) : !flatEn.has(key),
      )
      .map(({ key, file }) => `${key} (${file.slice(root.length + 1)})`);
    expect(missing).toEqual([]);
  });

  it("find keys in the code at all (the scanner works)", () => {
    expect(usedKeys().length).toBeGreaterThan(200);
  });
});
