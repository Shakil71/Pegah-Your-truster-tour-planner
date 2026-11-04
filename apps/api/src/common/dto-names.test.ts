import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Swagger names OpenAPI schemas after DTO class names. Two classes with the
 * same name silently overwrite each other in the document and corrupt the
 * generated client, so every DTO class name must be unique across the API.
 */
describe("DTO class names", () => {
  it("are unique across all controllers", () => {
    const root = resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) files.push(p);
      }
    };
    walk(root);
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const file of files) {
      for (const m of readFileSync(file, "utf8").matchAll(/class (\w+Dto) extends createZodDto/g)) {
        const prev = seen.get(m[1]!);
        if (prev && prev !== file) dupes.push(`${m[1]} (${prev} and ${file})`);
        seen.set(m[1]!, file);
      }
    }
    expect(dupes).toEqual([]);
  });
});
