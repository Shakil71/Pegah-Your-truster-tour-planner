import { describe, expect, it } from "vitest";
import { cleanText, decodeEntities, featureList } from "./text";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("Caf&eacute; &amp; bar")).toBe("Café & bar");
    expect(decodeEntities("40&#8243; TV &#x2013; HD")).toBe("40″ TV – HD");
  });

  it("leaves unknown entities and plain text alone", () => {
    expect(decodeEntities("A &unknown; B")).toBe("A &unknown; B");
    expect(decodeEntities("no entities")).toBe("no entities");
  });
});

describe("featureList", () => {
  it("splits a bullet-joined line from the old website", () => {
    expect(
      featureList("• express check — in and check out • welcome drinks on arrival • Caf&eacute;"),
    ).toEqual(["Express check — in and check out", "Welcome drinks on arrival", "Café"]);
  });

  it("splits one item per line", () => {
    expect(featureList("Sea view\n- Balcony\n\nFree WiFi.")).toEqual([
      "Sea view",
      "Balcony",
      "Free WiFi",
    ]);
  });

  it("returns a sentence as one item and nothing for empty text", () => {
    expect(featureList("A calm room facing the hills.")).toEqual(["A calm room facing the hills"]);
    expect(featureList(null)).toEqual([]);
    expect(cleanText("  a  b ")).toBe("a b");
  });
});
