import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A bare `z.string().nullable()` is emitted as `type: ["string","null"]` and
 * mis-read as an array by the OpenAPI generator, corrupting the generated
 * client (ADR-0020). Contracts must use `nullableText()` instead.
 */
describe("contract conventions", () => {
  it("never uses a bare nullable string", () => {
    const dir = resolve(__dirname, "../../../../packages/contracts/src");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) =>
        readFileSync(resolve(dir, f), "utf8")
          .split("\n")
          .map((line, i) => ({ f, i: i + 1, line }))
          .filter(
            ({ line }) => /z\.string\(\)\.nullable\(\)/.test(line) && !line.trim().startsWith("*"),
          ),
      )
      .map(({ f, i }) => `${f}:${i}`);
    expect(offenders).toEqual([]);
  });
});
