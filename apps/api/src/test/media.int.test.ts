/* Media library against MySQL 8.4 (ADR-0030): clean re-encoding, metadata
 * stripped, deduplication, immutable delivery, hero photos, safe deletion. */
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

async function photo(width: number, height: number, withGps = false): Promise<Buffer> {
  const img = sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 120, b: 80 } },
  }).jpeg({ quality: 80 });
  return withGps
    ? img
        .withExif({ IFD0: { Artist: "Secret Photographer", Copyright: "GPS 23.8103N 90.4125E" } })
        .toBuffer()
    : img.toBuffer();
}

describe.skipIf(!ADMIN_URL)("media library against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;

  beforeAll(async () => {
    h = await createHarness();
    owner = await h.staff("owner");
  }, 120_000);
  afterAll(() => h?.close());

  const upload = (
    body: Buffer,
    type = "image/jpeg",
    session: Session = owner,
    alt = "Tea garden at dawn",
  ) =>
    h.call("POST", `/admin/media?alt=${encodeURIComponent(alt)}&credit=Pegah%20team`, {
      session,
      headers: { "content-type": type },
      body,
    });

  it("re-encodes uploads as clean WebP, strips metadata and caps the size", async () => {
    const res = await upload(await photo(3000, 1500, true));
    expect(res.statusCode).toBe(201);
    const { media } = res.json();
    expect(media).toMatchObject({
      alt: "Tea garden at dawn",
      credit: "Pegah team",
      width: 2000,
      height: 1000,
    });
    expect(media.key).toMatch(/^[a-f0-9]{24}\.webp$/);
    expect(media.url).toBe(`/media/${media.key}`);

    const file = await h.call("GET", `/media/${media.key}`);
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("image/webp");
    expect(file.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const meta = await sharp(file.rawPayload).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(file.rawPayload.toString("latin1")).not.toContain("Secret Photographer");
  });

  it("stores the same picture once", async () => {
    const bytes = await photo(800, 600);
    const first = await upload(bytes);
    const again = await upload(bytes);
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(again.json().media.key).toBe(first.json().media.key);
  });

  it("refuses files that are not images, too large, or from staff without catalog:manage", async () => {
    const text = await upload(Buffer.from("<script>alert(1)</script>"), "image/png");
    expect(text.statusCode).toBe(422);
    const big = await upload(Buffer.alloc(1_000_001, 1));
    expect(big.statusCode).toBe(413);
    const support = await h.staff("support");
    const denied = await upload(await photo(400, 300), "image/jpeg", support);
    expect(denied.statusCode).toBe(403);
    const missingAlt = await h.call("POST", "/admin/media", {
      session: owner,
      headers: { "content-type": "image/jpeg" },
      body: await photo(400, 300),
    });
    expect(missingAlt.statusCode).toBe(400);
  });

  it("sets a hotel's main photo, shows it publicly, and blocks deleting it while used", async () => {
    const { media } = (
      await upload(await photo(1200, 800), "image/jpeg", owner, "Resort lawn")
    ).json();
    const hotel = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    const body = {
      destinationSlug: hotel.destination.slug,
      name: hotel.name,
      nameBn: hotel.nameBn,
      addressLine: hotel.addressLine,
      summary: "A quiet resort for media tests.",
      description: hotel.description,
      starRating: hotel.starRating,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      cancellationPolicy: "Free cancellation until three days before.",
      serviceChargeBps: hotel.serviceChargeBps,
      vatBps: hotel.vatBps,
      status: hotel.status,
    };
    const saved = await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: { ...body, heroMedia: media.key },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().hero).toMatchObject({ key: media.key, alt: "Resort lawn" });

    const pub = (await h.call("GET", "/hotels/it-hotel")).json();
    expect(pub.hero.url).toBe(`/media/${media.key}`);

    const del = await h.call("DELETE", `/admin/media/${media.key}`, { session: owner });
    expect(del.statusCode).toBe(409);

    await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: { ...body, heroMedia: null },
    });
    const ok = await h.call("DELETE", `/admin/media/${media.key}`, { session: owner });
    expect(ok.statusCode).toBe(204);
    expect((await h.call("GET", `/media/${media.key}`)).statusCode).toBe(404);

    const bad = await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: { ...body, heroMedia: "0123456789abcdef01234567.webp" },
    });
    expect(bad.statusCode).toBe(422);
  });

  it("lists images with where they are used and edits their caption", async () => {
    const list = await h.call("GET", "/admin/media", { session: owner });
    expect(list.statusCode).toBe(200);
    const item = list.json().items[0];
    expect(item.usedBy).toEqual({ hotels: 0, tours: 0, destinations: 0 });
    const edited = await h.call("PUT", `/admin/media/${item.key}`, {
      session: owner,
      body: { alt: "Updated caption", credit: null, license: "CC BY 4.0" },
    });
    expect(edited.json().media).toMatchObject({ alt: "Updated caption", license: "CC BY 4.0" });
  });
});
