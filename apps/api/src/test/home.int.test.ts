/* Home page editor against MySQL 8.4 (ADR-0031): featured items come from the
 * published catalog, missing ones drop out, slides need library images. */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("home page editor against MySQL 8.4", () => {
  let h: Harness;
  let content: Session;

  beforeAll(async () => {
    h = await createHarness();
    content = await h.staff("content");
  }, 120_000);
  afterAll(() => h?.close());

  const promise = {
    titleEn: "Prices in taka",
    titleBn: "দাম টাকায়",
    bodyEn: "Every tax is included before you pay.",
    bodyBn: "পেমেন্টের আগেই সব কর যুক্ত থাকে।",
  };

  it("publishes slides, featured catalog items and promises in the chosen order", async () => {
    const img = await sharp({
      create: { width: 1200, height: 700, channels: 3, background: { r: 10, g: 90, b: 140 } },
    })
      .jpeg()
      .toBuffer();
    const up = await h.call("POST", "/admin/media?alt=Haor%20at%20dawn", {
      session: content,
      headers: { "content-type": "image/jpeg" },
      body: img,
    });
    expect(up.statusCode).toBe(201);
    const key = up.json().media.key as string;
    const tour = await h.db.tour.findFirstOrThrow({ select: { slug: true } });

    const saved = await h.call("PUT", "/admin/home", {
      session: content,
      body: {
        slides: [{ media: key, placeEn: "Tanguar Haor", placeBn: "টাঙ্গুয়ার হাওর" }],
        featuredDestinations: ["it-dest", "no-such-place"],
        featuredHotels: ["no-such-hotel", "it-hotel"],
        featuredTours: [tour.slug],
        promises: [promise],
      },
    });
    expect(saved.statusCode).toBe(200);

    const home = (await h.call("GET", "/home")).json();
    expect(home.slides).toEqual([
      expect.objectContaining({
        url: `/media/${key}`,
        alt: "Haor at dawn",
        placeBn: "টাঙ্গুয়ার হাওর",
      }),
    ]);
    // Unknown slugs drop out; known ones keep the chosen order.
    expect(home.destinations.map((d: { slug: string }) => d.slug)).toEqual(["it-dest"]);
    expect(home.hotels.map((x: { slug: string }) => x.slug)).toEqual(["it-hotel"]);
    expect(home.tours.map((x: { slug: string }) => x.slug)).toEqual([tour.slug]);
    expect(home.promises).toEqual([promise]);

    // Unpublishing a featured hotel removes it from the home page at once.
    await h.db.hotel.update({ where: { slug: "it-hotel" }, data: { status: "DRAFT" } });
    expect((await h.call("GET", "/home")).json().hotels).toEqual([]);
    await h.db.hotel.update({ where: { slug: "it-hotel" }, data: { status: "PUBLISHED" } });
  });

  it("refuses slides with images that are not in the library, and staff without content:manage", async () => {
    const bad = await h.call("PUT", "/admin/home", {
      session: content,
      body: {
        slides: [
          { media: "0123456789abcdef01234567.webp", placeEn: "Nowhere", placeBn: "কোথাও না" },
        ],
        featuredDestinations: [],
        featuredHotels: [],
        featuredTours: [],
        promises: [],
      },
    });
    expect(bad.statusCode).toBe(422);
    const support = await h.staff("support");
    const denied = await h.call("GET", "/admin/home", { session: support });
    expect(denied.statusCode).toBe(403);
  });
});
