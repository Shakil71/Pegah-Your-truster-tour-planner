import { describe, expect, it } from "vitest";
import { cleanText, decodeEntities, detailSections, featureList } from "./text";

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
  it("splits a bullet-joined line and drops a point cut short by the import", () => {
    expect(
      featureList(
        "• express check — in and check out • welcome drinks on arrival • 2 Caf&eacute;s with Bangla, Indian, Thai, Chinese cuisine. • Exclusive dining room •…",
      ),
    ).toEqual([
      "Express check — in and check out",
      "Welcome drinks on arrival",
      "2 Cafés with Bangla, Indian, Thai, Chinese cuisine",
      "Exclusive dining room",
    ]);
  });

  it("turns an 'in room – a, b, c' sentence into points and drops list intros", () => {
    expect(
      featureList(
        "Deluxe room with a large balcony and sea view. in room – mini bar, safe deposit box, led tv , hot & cold water, daily newspaper etc. The room includes the following privileges of complimentary services as follows: • express…",
      ),
    ).toEqual([
      "Deluxe room with a large balcony and sea view",
      "Mini bar",
      "Safe deposit box",
      "Led tv",
      "Hot & cold water",
      "Daily newspaper",
    ]);
  });

  it("reads ** lists and skips the intro sentence", () => {
    expect(
      featureList(
        "You get the below amenities & facilities for this room. ** Wooden interior. ** Mizoram view balcony. ** Room service 6AM-11PM",
      ),
    ).toEqual(["Wooden interior", "Mizoram view balcony", "Room service 6AM-11PM"]);
  });

  it("splits one item per line and plain sentences", () => {
    expect(featureList("Sea view\n- Balcony\n\nFree WiFi.")).toEqual([
      "Sea view",
      "Balcony",
      "Free WiFi",
    ]);
    expect(featureList("## A calm room. It faces the hills.")).toEqual([
      "A calm room",
      "It faces the hills",
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(featureList(null)).toEqual([]);
    expect(cleanText("  a  b ")).toBe("a b");
  });
});

describe("detailSections", () => {
  it("groups points under ## headings and decodes &Prime;", () => {
    expect(
      detailSections(
        "## Make your stay new\n\nA suite for couples and families.\n\n## Suite Features and Amenities\n\nThe bedroom contains a king-size bed, 32&Prime; LCD TV, Mini Fridge, Hair Dryer, and ISD Telephone.",
      ),
    ).toEqual([
      { title: "Make your stay new", points: ["A suite for couples and families"] },
      {
        title: "Suite Features and Amenities",
        points: [
          "The bedroom contains a king-size bed",
          "32″ LCD TV",
          "Mini Fridge",
          "Hair Dryer",
          "ISD Telephone",
        ],
      },
    ]);
  });

  it("keeps a prose sentence with commas whole", () => {
    expect(
      featureList(
        "With amenities such as, a romantic Jacuzzi, bathrobe, and luxurious bathroom fittings, your life would enjoy the most wonderful experience ever in our honeymoon suite.",
      ),
    ).toHaveLength(1);
  });

  it("returns one untitled section for plain text and none for empty text", () => {
    expect(detailSections("• Sea view\n• Balcony")).toEqual([
      { title: null, points: ["Sea view", "Balcony"] },
    ]);
    expect(detailSections("")).toEqual([]);
  });
});
