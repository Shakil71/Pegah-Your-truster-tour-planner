import { describe, expect, it } from "vitest";
import { offerFacts, offerSections, wholeSentences } from "./offer-details";

const UMRAH = [
  "📒 Our Ramadan Economy Umrah Package includes all the best facilities~",
  "~Visa with all charges~",
  "~Health insurance",
  "~Return air tickets (Transit flights like Qatar Airways)",
  "~Two times of food per day",
  "~Transportation from Makkah - Madinah by Bus",
  "Hotel Details~",
  "Makkah Hotel- Rehab Al Bustan at Mecca Hijra Road or Similar",
  "Madina Hotel- Rama Al Madinah, Dar al maarij or similar",
  "Visa requirements~",
  "~Passport with six-month validity",
  "## Policy",
  "Payment Policy:",
  "Phase-1: 80% of the total package amount at the time of booking.",
  "Cancellation policy:",
  "The package is non-refundable and non-changeable.",
  "## Contact",
  "Dhaka Office",
  "Address: 153/1, Shahali Bag, Mirpur-1, Dhaka",
  "Mobile: +8801774483530",
].join("\n\n");

describe("offerSections", () => {
  const sections = offerSections(UMRAH);

  it("finds each section and its kind", () => {
    expect(sections.map((s) => [s.kind, s.title])).toEqual([
      ["included", "Our Ramadan Economy Umrah Package includes all the best facilities"],
      ["hotels", "Hotel Details"],
      ["requirements", "Visa requirements"],
      ["policy", "Policy"],
      ["contact", "Contact"],
    ]);
  });

  it("reads ~points, dash rows, sub-headings and office groups", () => {
    expect(sections[0]!.items[0]).toEqual({ type: "point", text: "Visa with all charges" });
    expect(sections[1]!.items[0]).toEqual({
      type: "row",
      label: "Makkah Hotel",
      value: "Rehab Al Bustan at Mecca Hijra Road or Similar",
    });
    expect(sections[3]!.items).toEqual([
      { type: "sub", text: "Payment Policy" },
      {
        type: "row",
        label: "Phase-1",
        value: "80% of the total package amount at the time of booking.",
      },
      { type: "sub", text: "Cancellation policy" },
      { type: "point", text: "The package is non-refundable and non-changeable" },
    ]);
    expect(sections[4]!.items[0]).toEqual({ type: "sub", text: "Dhaka Office" });
    expect(sections[4]!.items[2]).toEqual({
      type: "row",
      label: "Mobile",
      value: "+8801774483530",
    });
  });

  it("merges offices written as headings and strips emoji bullets", () => {
    const s = offerSections(
      [
        "## Inclusions and exclusions",
        "❇️ Return Air ticket with transit airlines",
        "## Dhaka Office",
        "Phone: 01774483530",
        "Address:Shahalibag, Mirpur-1, Dhaka",
        "## Faridpur Office",
        "Phone: 01722880128",
      ].join("\n"),
    );
    expect(s.map((x) => x.kind)).toEqual(["included", "contact"]);
    expect(s[0]!.items).toEqual([
      { type: "point", text: "Return Air ticket with transit airlines" },
    ]);
    expect(s[1]!.items).toEqual([
      { type: "sub", text: "Dhaka Office" },
      { type: "row", label: "Phone", value: "01774483530" },
      { type: "row", label: "Address", value: "Shahalibag, Mirpur-1, Dhaka" },
      { type: "sub", text: "Faridpur Office" },
      { type: "row", label: "Phone", value: "01722880128" },
    ]);
  });

  it("returns nothing for empty text and one untitled section for plain text", () => {
    expect(offerSections("")).toEqual([]);
    expect(offerSections("A relaxed weekend by the sea.")).toEqual([
      {
        title: null,
        kind: "other",
        items: [{ type: "point", text: "A relaxed weekend by the sea" }],
      },
    ]);
  });
});

describe("offerFacts", () => {
  it("reads duration and nights from the title and summary, inclusions from the included section", () => {
    const facts = offerFacts(
      "Ramadan Economy Umrah Package- 14 Days",
      "7 Nights in Makkah and 7 Nights in Madinah.",
      offerSections(UMRAH),
    );
    expect(facts).toEqual({
      days: 14,
      nights: [
        { city: "Makkah", count: 7 },
        { city: "Madinah", count: 7 },
      ],
      visa: true,
      flights: true,
      meals: true,
      transport: true,
      insurance: true,
    });
  });

  it("claims nothing the text does not say", () => {
    expect(offerFacts("Winter weekend", "Two nights by the sea.", [])).toEqual({
      days: null,
      nights: [],
      visa: false,
      flights: false,
      meals: false,
      transport: false,
      insurance: false,
    });
  });
});

describe("wholeSentences", () => {
  it("drops a sentence clipped with an ellipsis", () => {
    expect(wholeSentences("Seven nights in Makkah. Staff will help. Sightseeing and…")).toBe(
      "Seven nights in Makkah. Staff will help.",
    );
    expect(wholeSentences("Complete text.")).toBe("Complete text.");
  });
});
