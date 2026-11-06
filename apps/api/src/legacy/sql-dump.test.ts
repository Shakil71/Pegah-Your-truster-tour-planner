import { describe, expect, it } from "vitest";
import {
  clip,
  dhakaToUtc,
  htmlToList,
  htmlToText,
  mapUrl,
  parseDump,
  slugify,
  takaToMinor,
  toHhMm,
} from "./sql-dump";

describe("parseDump", () => {
  it("reads multi-row inserts with escapes, NULLs and numbers", () => {
    const sql = `CREATE TABLE \`t\` (x int);
INSERT INTO \`t\` (\`id\`, \`name\`, \`note\`) VALUES
(1, 'Cox\\'s Bazar', NULL),
(2, 'Line\\nbreak, and (parens)', 'it''s');
INSERT INTO \`t\` (\`id\`, \`name\`, \`note\`) VALUES
(3, '', '৳ ১০০');
`;
    const dump = parseDump(sql);
    expect(dump.t).toEqual([
      { id: "1", name: "Cox's Bazar", note: null },
      { id: "2", name: "Line\nbreak, and (parens)", note: "it's" },
      { id: "3", name: "", note: "৳ ১০০" },
    ]);
  });

  it("rejects a row whose value count does not match the columns", () => {
    expect(() => parseDump("INSERT INTO `t` (`a`, `b`) VALUES\n(1);\n")).toThrow(/1 values for 2/);
  });
});

describe("text helpers", () => {
  it("turns CMS HTML into plain paragraphs, headings and bullets", () => {
    const html =
      "<h3>Inclusions</h3><p>Return air ticket&nbsp;for <strong>two</strong>.</p><ul>\r\n\t<li>Breakfast</li>\r\n\t<li>Cox&#39;s Bazar tour</li></ul>";
    expect(htmlToText(html)).toBe(
      "## Inclusions\n\nReturn air ticket for two.\n\n• Breakfast\n• Cox's Bazar tour",
    );
    expect(htmlToList(html)).toEqual(["Breakfast", "Cox's Bazar tour"]);
    expect(htmlToList("<p>One</p><p>Two</p>")).toEqual(["One", "Two"]);
  });

  it("clips, slugs and parses times, money, maps and dates", () => {
    expect(clip("a quick brown fox jumps", 12)).toBe("a quick…");
    expect(slugify("Grace Cox Smart Hotel, Cox's Bazar")).toBe("grace-cox-smart-hotel-coxs-bazar");
    expect(toHhMm("2:00 PM")).toBe("14:00");
    expect(toHhMm("12:00 AM")).toBe("00:00");
    expect(toHhMm("13:00")).toBe("13:00");
    expect(toHhMm("")).toBeNull();
    expect(takaToMinor("4500.00")).toBe(450_000n);
    expect(takaToMinor("from 135,000 BDT/Per Person")).toBe(13_500_000n);
    expect(takaToMinor("n/a")).toBeNull();
    expect(mapUrl('<iframe src="https://www.google.com/maps/embed?pb=1&amp;x=2"></iframe>')).toBe(
      "https://www.google.com/maps/embed?pb=1&x=2",
    );
    expect(mapUrl("javascript:alert(1)")).toBeNull();
    expect(dhakaToUtc("2024-11-01 10:00:00")?.toISOString()).toBe("2024-11-01T04:00:00.000Z");
  });
});
