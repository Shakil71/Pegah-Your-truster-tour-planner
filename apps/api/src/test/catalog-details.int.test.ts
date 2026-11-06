/* Galleries, facilities and the long-form hotel/room/tour fields (ADR-0038) against MySQL 8.4. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, createHarness, type Harness, type Session } from "./int-harness";

describe.skipIf(!ADMIN_URL)("catalog details against MySQL 8.4", () => {
  let h: Harness;
  let owner: Session;
  const keys = [
    "aaaaaaaaaaaaaaaaaaaaaaa1.webp",
    "bbbbbbbbbbbbbbbbbbbbbbb2.webp",
    "ccccccccccccccccccccccc3.webp",
  ];

  beforeAll(async () => {
    h = await createHarness();
    owner = await h.staff("owner");
    for (const [i, storageKey] of keys.entries()) {
      await h.db.mediaAsset.create({
        data: {
          storageKey,
          altText: `Photo ${i + 1}`,
          blob: { create: { mime: "image/webp", bytes: new Uint8Array([1, 2, 3]) } },
        },
      });
    }
  }, 120_000);
  afterAll(() => h?.close());

  async function hotelBody() {
    const cur = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    return {
      destinationSlug: cur.destination.slug,
      name: cur.name,
      nameBn: null,
      starRating: null,
      addressLine: cur.addressLine,
      summary: "A calm hotel by the river.",
      description: "## Rooms\n\nQuiet rooms.\n\n• River view\n• Breakfast",
      checkInTime: cur.checkInTime,
      checkOutTime: cur.checkOutTime,
      cancellationPolicy: "Free cancellation up to 3 days before arrival.",
      serviceChargeBps: cur.serviceChargeBps,
      vatBps: cur.vatBps,
      status: "PUBLISHED",
    };
  }

  it("manages facilities: staff with catalog rights only, no duplicates", async () => {
    const support = await h.staff("support");
    const denied = await h.call("POST", "/admin/amenities", {
      session: support,
      body: { scope: "HOTEL", name: "Free Wi-Fi" },
    });
    expect(denied.statusCode).toBe(403);
    const made = await h.call("POST", "/admin/amenities", {
      session: owner,
      body: { scope: "HOTEL", name: "Free Wi-Fi", group: "Internet" },
    });
    expect(made.statusCode).toBe(201);
    expect(made.json().amenity).toEqual({
      slug: "free-wi-fi",
      name: "Free Wi-Fi",
      group: "Internet",
    });
    const again = await h.call("POST", "/admin/amenities", {
      session: owner,
      body: { scope: "HOTEL", name: "Free Wi-Fi" },
    });
    expect(again.json().amenity.slug).toBe("free-wi-fi");
    await h.call("POST", "/admin/amenities", {
      session: owner,
      body: { scope: "ROOM", name: "Balcony" },
    });
    await h.call("POST", "/admin/amenities", {
      session: owner,
      body: { scope: "TOUR", name: "Guide" },
    });
    const list = await h.call("GET", "/admin/amenities?scope=HOTEL", { session: owner });
    expect(list.json().items).toHaveLength(1);
  });

  it("saves hotel details, gallery order and facilities, and shows them on the website", async () => {
    const res = await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: {
        ...(await hotelBody()),
        propertyType: "RESORT",
        distanceFromCity: "3 km from town",
        childPolicy: "Children under 5 stay free.",
        petPolicy: "Not allowed",
        houseRules: "• No smoking\n• Quiet after 10 pm",
        breakfast: "Yes",
        nearbyPlaces: ["Ghat", "Market"],
        gallery: ["ccccccccccccccccccccccc3.webp", "aaaaaaaaaaaaaaaaaaaaaaa1.webp"],
        amenities: ["free-wi-fi"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      propertyType: "RESORT",
      distanceFromCity: "3 km from town",
      nearbyPlaces: ["Ghat", "Market"],
      amenities: ["free-wi-fi"],
    });
    expect(res.json().gallery.map((g: { key: string }) => g.key)).toEqual([
      "ccccccccccccccccccccccc3.webp",
      "aaaaaaaaaaaaaaaaaaaaaaa1.webp",
    ]);

    const site = (await h.call("GET", "/hotels/it-hotel")).json();
    expect(site).toMatchObject({
      propertyType: "RESORT",
      childPolicy: "Children under 5 stay free.",
      houseRules: "• No smoking\n• Quiet after 10 pm",
      nearbyPlaces: ["Ghat", "Market"],
      amenities: [{ slug: "free-wi-fi", name: "Free Wi-Fi", group: "Internet", icon: null }],
    });
    expect(site.gallery.map((g: { alt: string }) => g.alt)).toEqual(["Photo 3", "Photo 1"]);

    // Omitting gallery and facilities keeps them; sending [] clears them.
    await h.call("PUT", "/admin/hotels/it-hotel", { session: owner, body: await hotelBody() });
    let after = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    expect(after.gallery).toHaveLength(2);
    expect(after.amenities).toEqual(["free-wi-fi"]);
    await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: { ...(await hotelBody()), gallery: [], amenities: [] },
    });
    after = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    expect(after.gallery).toEqual([]);
    expect(after.amenities).toEqual([]);
  });

  it("rejects unknown photos and facilities without changing anything", async () => {
    const before = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    const badPhoto = await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: {
        ...(await hotelBody()),
        summary: "Changed summary text",
        gallery: ["ddddddddddddddddddddddd4.webp"],
      },
    });
    expect(badPhoto.statusCode).toBe(422);
    const badAmenity = await h.call("PUT", "/admin/hotels/it-hotel", {
      session: owner,
      body: { ...(await hotelBody()), amenities: ["balcony"] }, // a ROOM facility, not a HOTEL one
    });
    expect(badAmenity.statusCode).toBe(422);
    const after = (await h.call("GET", "/admin/hotels/it-hotel", { session: owner })).json();
    expect(after.summary).toBe(before.summary);
  });

  it("saves room photos, facilities and details", async () => {
    const res = await h.call("PUT", `/admin/rooms/${h.roomId}`, {
      session: owner,
      body: {
        name: "Deluxe",
        description: "Deluxe",
        maxAdults: 2,
        maxChildren: 1,
        bedType: "King",
        sizeSqm: 30,
        isActive: true,
        roomType: "Couple Deluxe",
        details: "Balcony over the river.",
        airConditioned: "YES",
        extraBeds: 1,
        gallery: ["bbbbbbbbbbbbbbbbbbbbbbb2.webp"],
        amenities: ["balcony"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().room).toMatchObject({
      roomType: "Couple Deluxe",
      airConditioned: true,
      extraBeds: 1,
      amenities: ["balcony"],
      rackRate: null,
    });
    const site = (await h.call("GET", "/hotels/it-hotel")).json();
    expect(site.rooms[0]).toMatchObject({
      roomType: "Couple Deluxe",
      details: "Balcony over the river.",
      airConditioned: true,
      extraBeds: 1,
      amenities: [{ slug: "balcony", name: "Balcony" }],
    });
    expect(site.rooms[0].gallery).toHaveLength(1);
    // Search results keep the compact room shape.
    const unknown = await h.call("PUT", `/admin/rooms/${h.roomId}`, {
      session: owner,
      body: {
        ...res.json().room,
        id: undefined,
        rackRate: undefined,
        discountRate: undefined,
        units: undefined,
        airConditioned: "UNKNOWN",
        gallery: ["bbbbbbbbbbbbbbbbbbbbbbb2.webp"],
      },
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json().room.airConditioned).toBeNull();
  });

  it("saves tour sections, pickup points, tags, gallery and facilities", async () => {
    const cur = (await h.call("GET", "/admin/tours/it-tour", { session: owner })).json();
    const res = await h.call("PUT", "/admin/tours/it-tour", {
      session: owner,
      body: {
        destinationSlug: cur.destination.slug,
        title: cur.title,
        summary: "Two days on the river.",
        description: "A slow river trip with a guide.",
        durationDays: cur.durationDays,
        durationNights: cur.durationNights,
        meetingPoint: cur.meetingPoint,
        groupSizeMax: cur.groupSizeMax,
        highlights: ["Sunset"],
        includes: ["Meals"],
        excludes: [],
        vatBps: cur.vatBps,
        status: "PUBLISHED",
        tourType: "Family",
        itinerary: "Day one: boat.\n\nDay two: village.",
        cancellationPolicy: "Full refund 7 days before.",
        travelTips: "Bring a hat.",
        pickupPoints: ["Sadarghat", "Airport"],
        tags: ["Kid Friendly"],
        minAdults: 2,
        gallery: ["aaaaaaaaaaaaaaaaaaaaaaa1.webp", "bbbbbbbbbbbbbbbbbbbbbbb2.webp"],
        amenities: ["guide"],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tourType: "Family", minAdults: 2, amenities: ["guide"] });
    const site = (await h.call("GET", "/tours/it-tour")).json();
    expect(site).toMatchObject({
      tourType: "Family",
      itinerary: "Day one: boat.\n\nDay two: village.",
      cancellationPolicy: "Full refund 7 days before.",
      travelTips: "Bring a hat.",
      pickupPoints: ["Sadarghat", "Airport"],
      tags: ["Kid Friendly"],
      amenities: [{ slug: "guide", name: "Guide" }],
    });
    expect(site.gallery).toHaveLength(2);
  });
});
