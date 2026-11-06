/* Old-website import against MySQL 8.4 (ADR-0038): additive, lossless, repeatable. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importLegacy } from "../legacy/importer";
import { parseDump } from "../legacy/sql-dump";
import { ADMIN_URL, createHarness, type Harness } from "./int-harness";

const OLD_HASH = bcrypt.hashSync("old-site-pass", 4).replace(/^\$2b\$/, "$2y$");

const SQL = `-- phpMyAdmin SQL Dump (fixture)
INSERT INTO \`cities\` (\`id\`, \`city_name\`, \`slug\`) VALUES
(1, 'Cox\\'s Bazar', 'coxs-bazar'),
(2, 'Ranibazar', 'ranibazar');
INSERT INTO \`hotel_types\` (\`id\`, \`type_name\`) VALUES
(1, 'Hotel & Resort');
INSERT INTO \`facility_types\` (\`id\`, \`type_name\`) VALUES
(1, 'Parking');
INSERT INTO \`hotel_facilities\` (\`id\`, \`facility_type_id\`, \`facility_name\`, \`icon\`) VALUES
(1, 1, 'Free Parking', NULL);
INSERT INTO \`room_facilities\` (\`id\`, \`facility_type_id\`, \`facility_name\`, \`icon\`) VALUES
(1, NULL, 'Balcony', NULL);
INSERT INTO \`hotel_charges\` (\`id\`, \`vat\`, \`service_charge\`) VALUES
(1, '15', '10');
INSERT INTO \`hotels\` (\`id\`, \`sorting_serial\`, \`name\`, \`slug\`, \`type_id\`, \`city_id\`, \`address\`, \`image\`, \`mobile\`, \`email\`, \`map_link\`, \`hotel_details\`, \`check_in_time\`, \`check_out_time\`, \`child_policy\`, \`child_rules\`, \`pet_policy\`, \`house_rules\`, \`cancellation_policy\`, \`password\`, \`status\`) VALUES
(7, 2, 'Legacy Sea Resort', 'legacy-sea-resort', 1, 1, 'Marine Drive', 'images/hotel/front.png', '01700000000', 'desk@example.com', '<iframe src="https://www.google.com/maps/embed?pb=1"></iframe>', '<p>Sea view rooms &amp; a pool.</p>', '2:00 PM', '11:00', 'Allowed', '<p>Under 5 free.</p>', 'Not Allowed', '<ul><li>No smoking</li></ul>', '<p>Free cancellation 3 days before.</p>', '$2y$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyzABCDE', 1);
INSERT INTO \`hotel_images\` (\`id\`, \`hotel_id\`, \`image\`) VALUES
(1, 7, 'images/hotel/front.png'),
(2, 7, 'images/hotel/missing.jpg');
INSERT INTO \`hotel_facility_pairs\` (\`id\`, \`hotel_id\`, \`hotel_facility_id\`) VALUES
(1, 7, 1);
INSERT INTO \`hotel_nearby_places\` (\`id\`, \`hotel_id\`, \`place_name\`) VALUES
(1, 7, 'Kolatoli Beach');
INSERT INTO \`room_types\` (\`id\`, \`type_name\`) VALUES
(3, 'Couple Deluxe');
INSERT INTO \`hotel_rooms\` (\`id\`, \`hotel_id\`, \`room_name\`, \`room_type\`, \`regular_price\`, \`discount_price\`, \`adult_capacity\`, \`child_capacity\`, \`room_details\`, \`total_bed\`, \`total_double_bed\`, \`room_size\`, \`quantity\`, \`air_condition\`, \`status\`) VALUES
(11, 7, 'Sea View King', '3', '6500.00', '5900.00', 2, 1, '<p>King bed, balcony.</p>', '1', '1', '400 sqft', 4, 'Yes', 1),
(12, 99, 'Orphan Room', '3', '100.00', '0.00', 2, 0, NULL, '1', NULL, NULL, 1, 'No', 1);
INSERT INTO \`hotel_room_facility_pairs\` (\`id\`, \`hotel_room_id\`, \`room_facility_id\`) VALUES
(1, 11, 1);
INSERT INTO \`tour_cities\` (\`id\`, \`city_name\`, \`slug\`) VALUES
(5, 'Sain\\'t Martin', 'st');
INSERT INTO \`tours\` (\`id\`, \`city_id\`, \`type_id\`, \`location\`, \`title\`, \`slug\`, \`price\`, \`discount_price\`, \`night\`, \`day\`, \`capacity\`, \`max_capacity\`, \`highlights\`, \`overview\`, \`itinerary\`, \`inclusion\`, \`pick_up_location\`, \`status\`) VALUES
(3, 5, NULL, 'St. Martin Island', 'Island Escape', 'island-escape', '8500.00', '0.00', 2, 3, '30', 30, '<ul><li>Boat ride</li></ul>', '<p>Two nights by the sea.</p>', '<p>Day one: ship.</p>', '<ul><li>Hotel</li><li>Meals</li></ul>', '<ul><li>Teknaf jetty</li></ul>', 0);
INSERT INTO \`packages\` (\`id\`, \`type_id\`, \`title\`, \`slug\`, \`start_from\`, \`location\`, \`short_info\`, \`details\`, \`status\`, \`sorting_serial\`) VALUES
(1, 2, 'Economy Umrah', 'economy-umrah', 'from 140000 BDT/Per Person', 'Makkah', '<p>14 days.</p>', '<p>Hotel near Haram.</p>', 2, 1);
INSERT INTO \`users\` (\`id\`, \`name\`, \`email\`, \`mobile\`, \`national_id\`, \`email_verified_at\`, \`password\`, \`status\`, \`remember_token\`, \`created_at\`) VALUES
(1, 'Rahim Uddin', 'Rahim@Example.com', '01711111111', '1234567890', NULL, '${OLD_HASH}', 1, 'tok', '2023-01-02 10:00:00'),
(2, 'No Email', NULL, '01722222222', NULL, NULL, '${OLD_HASH}', 1, NULL, NULL),
(3, 'Existing Person', 'already@example.com', NULL, NULL, NULL, '${OLD_HASH}', 1, NULL, NULL);
INSERT INTO \`coupons\` (\`id\`, \`coupon_code\`, \`discount_type\`, \`discount\`, \`minimum_cost\`, \`up_to\`, \`used_limit\`, \`start_date\`, \`end_date\`, \`status\`) VALUES
(6, 'welbk25', '2', '20', '2500', '1000', '1', '2025-01-01 00:00:00', '2025-04-30 23:59:59', 1);
INSERT INTO \`privacy_policies\` (\`id\`, \`privacy_policies\`) VALUES
(1, '<h2>Your data</h2><p>We keep it safe.</p>');
INSERT INTO \`user_messages\` (\`id\`, \`name\`, \`mobile\`, \`email\`, \`subject\`, \`message\`) VALUES
(1, 'Karim', '017', 'k@example.com', 'Hi', 'Need a room');
INSERT INTO \`sessions\` (\`id\`, \`user_id\`, \`payload\`) VALUES
('abc', 1, 'secret-session');
INSERT INTO \`otp_sent_mobiles\` (\`id\`, \`mobile\`, \`otp_code\`) VALUES
(1, '017', '9999');
`;

describe.skipIf(!ADMIN_URL)("old website import against MySQL 8.4", () => {
  let h: Harness;
  let images: string;
  const dump = parseDump(SQL);

  beforeAll(async () => {
    h = await createHarness();
    images = mkdtempSync(path.join(tmpdir(), "pegah-legacy-"));
    mkdirSync(path.join(images, "hotel"));
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 120, b: 40 } },
    })
      .png()
      .toBuffer();
    writeFileSync(path.join(images, "hotel", "front.png"), png);
    await h.register("already@example.com");
  }, 120_000);
  afterAll(async () => {
    rmSync(images, { recursive: true, force: true });
    await h?.close();
  });

  it("a dry run checks everything and writes nothing", async () => {
    const before = await h.db.hotel.count();
    const report = await importLegacy(h.db, dump, images, { dryRun: true });
    expect(report.counts.get("hotels created (draft)")).toBe(1);
    expect(await h.db.hotel.count()).toBe(before);
    expect(await h.db.legacyRecord.count()).toBe(0);
    expect(await h.db.mediaAsset.count({ where: { credit: { contains: "old Pegah" } } })).toBe(0);
  });

  it("imports the catalog as drafts with every field mapped", async () => {
    const report = await importLegacy(h.db, dump, images);
    expect(report.notes.some((n) => n.includes("missing.jpg"))).toBe(true);

    const hotel = await h.db.hotel.findFirstOrThrow({
      where: { slug: "legacy-sea-resort" },
      include: {
        destination: true,
        gallery: true,
        amenities: { include: { amenity: true } },
        rooms: { include: { gallery: true, amenities: true } },
      },
    });
    expect(hotel).toMatchObject({
      name: "Legacy Sea Resort",
      status: "DRAFT",
      addressLine: "Marine Drive",
      description: "Sea view rooms & a pool.",
      checkInTime: "14:00",
      checkOutTime: "11:00",
      cancellationPolicy: "Free cancellation 3 days before.",
      vatBps: 1500,
      serviceChargeBps: 1000,
      propertyType: "HOTEL_RESORT",
      phone: "01700000000",
      email: "desk@example.com",
      mapUrl: "https://www.google.com/maps/embed?pb=1",
      childPolicy: "Allowed\n\nUnder 5 free.",
      petPolicy: "Not Allowed",
      houseRules: "• No smoking",
      nearbyPlaces: ["Kolatoli Beach"],
      sortOrder: 2,
    });
    expect(hotel.destination.slug).toBe("coxs-bazar");
    expect(hotel.heroMediaId).not.toBeNull();
    expect(hotel.gallery).toHaveLength(1);
    expect(hotel.amenities.map((a) => a.amenity.name)).toEqual(["Free Parking"]);
    expect(hotel.rooms).toHaveLength(1);
    expect(hotel.rooms[0]).toMatchObject({
      name: "Sea View King",
      roomType: "Couple Deluxe",
      maxAdults: 2,
      maxChildren: 1,
      bedType: "1 bed",
      sizeSqm: 37,
      sizeLabel: "400 sqft",
      airConditioned: true,
      units: 4,
      rackRateMinor: 650_000n,
      discountRateMinor: 590_000n,
      beds: { total: "1", single: null, double: 1, triple: null },
    });
    expect(hotel.rooms[0]!.amenities).toHaveLength(1);
    // No rates or inventory are invented: staff set real prices before publishing.
    expect(await h.db.roomRate.count({ where: { roomId: hotel.rooms[0]!.id } })).toBe(0);

    const tour = await h.db.tour.findFirstOrThrow({
      where: { slug: "island-escape" },
      include: { destination: true },
    });
    expect(tour).toMatchObject({
      status: "DRAFT",
      durationDays: 3,
      durationNights: 2,
      groupSizeMax: 30,
      highlights: ["Boat ride"],
      includes: ["Hotel", "Meals"],
      pickupPoints: ["Teknaf jetty"],
      meetingPoint: "Teknaf jetty",
      itinerary: "Day one: ship.",
      listPriceMinor: 850_000n,
      salePriceMinor: null,
    });
    expect(tour.destination.slug).toBe("saint-martin");

    const offer = await h.db.offer.findFirstOrThrow({ where: { slug: "economy-umrah" } });
    expect(offer).toMatchObject({ status: "DRAFT", priceMinor: 14_000_000n });

    const promo = await h.db.promotion.findUniqueOrThrow({ where: { code: "WELBK25" } });
    expect(promo).toMatchObject({ status: "PAUSED", kind: "PERCENT", percentBps: 2000 });
    const page = await h.db.contentPage.findUniqueOrThrow({ where: { slug: "privacy" } });
    expect(page).toMatchObject({ status: "DRAFT", body: "## Your data\n\nWe keep it safe." });
  });

  it("keeps every source row verbatim, except credentials and skipped tables", async () => {
    const tables = Object.entries(dump).filter(
      ([t]) => !["sessions", "otp_sent_mobiles"].includes(t),
    );
    const expected = tables.reduce((n, [, rows]) => n + rows.length, 0);
    expect(await h.db.legacyRecord.count()).toBe(expected);
    expect(await h.db.legacyRecord.count({ where: { sourceTable: "sessions" } })).toBe(0);
    const user = await h.db.legacyRecord.findUniqueOrThrow({
      where: { sourceTable_sourceId: { sourceTable: "users", sourceId: "1" } },
    });
    const payload = user.payload as Record<string, unknown>;
    expect(payload.name).toBe("Rahim Uddin");
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("remember_token");
    expect(payload).not.toHaveProperty("national_id");
    const hotel = await h.db.legacyRecord.findUniqueOrThrow({
      where: { sourceTable_sourceId: { sourceTable: "hotels", sourceId: "7" } },
    });
    expect(hotel.targetType).toBe("hotel");
    expect(hotel.payload).not.toHaveProperty("password");
    const orphan = await h.db.legacyRecord.findUniqueOrThrow({
      where: { sourceTable_sourceId: { sourceTable: "hotel_rooms", sourceId: "12" } },
    });
    expect(orphan.targetId).toBeNull();
    const message = await h.db.legacyRecord.findUniqueOrThrow({
      where: { sourceTable_sourceId: { sourceTable: "user_messages", sourceId: "1" } },
    });
    expect((message.payload as Record<string, unknown>).message).toBe("Need a room");
  });

  it("imports customers who can sign in with their old password, upgraded to Argon2id", async () => {
    const existing = await h.db.user.findUniqueOrThrow({ where: { email: "already@example.com" } });
    expect(existing.fullName).toBe("Test Traveller"); // never overwritten
    const link = await h.db.legacyRecord.findUniqueOrThrow({
      where: { sourceTable_sourceId: { sourceTable: "users", sourceId: "3" } },
    });
    expect(link.targetId).toBe(existing.id);
    expect(await h.db.legacyRecord.count({ where: { sourceTable: "users", targetId: null } })).toBe(
      1,
    );

    const rahim = await h.db.user.findUniqueOrThrow({ where: { email: "rahim@example.com" } });
    expect(rahim).toMatchObject({
      fullName: "Rahim Uddin",
      phone: "01711111111",
      kind: "CUSTOMER",
    });
    expect(rahim.createdAt.toISOString()).toBe("2023-01-02T04:00:00.000Z");

    const bad = await h.call("POST", "/auth/login", {
      body: { email: "rahim@example.com", password: "nope-nope-nope" },
      remoteAddress: "10.40.0.1",
    });
    expect(bad.statusCode).toBe(401);
    const ok = await h.call("POST", "/auth/login", {
      body: { email: "rahim@example.com", password: "old-site-pass" },
      remoteAddress: "10.40.0.2",
    });
    expect(ok.statusCode).toBe(200);
    const upgraded = await h.db.user.findUniqueOrThrow({ where: { id: rahim.id } });
    expect(upgraded.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("a second run adds nothing and changes nothing", async () => {
    const counts = async () => ({
      hotels: await h.db.hotel.count(),
      rooms: await h.db.hotelRoom.count(),
      tours: await h.db.tour.count(),
      users: await h.db.user.count(),
      media: await h.db.mediaAsset.count(),
      archive: await h.db.legacyRecord.count(),
      amenities: await h.db.amenity.count(),
      offers: await h.db.offer.count(),
    });
    const before = await counts();
    const report = await importLegacy(h.db, dump, images);
    expect(await counts()).toEqual(before);
    expect(report.counts.get("hotels already imported")).toBe(1);
    expect(report.counts.get("archive rows written")).toBe(0);
  });

  it("shows the archive in the console to owners only, with search", async () => {
    const owner = await h.staff("owner");
    const support = await h.staff("support");
    expect((await h.call("GET", "/admin/legacy/tables", { session: support })).statusCode).toBe(
      403,
    );

    const tables = await h.call("GET", "/admin/legacy/tables", { session: owner });
    expect(tables.statusCode).toBe(200);
    expect(tables.json().tables).toContainEqual({ table: "users", rows: 3, linked: 2 });

    const found = await h.call("GET", "/admin/legacy/records?table=user_messages&q=need%20a", {
      session: owner,
    });
    expect(found.json().items).toHaveLength(1);
    expect(found.json().items[0].payload.name).toBe("Karim");
    // LIKE wildcards are literal.
    const none = await h.call("GET", "/admin/legacy/records?table=user_messages&q=%25", {
      session: owner,
    });
    expect(none.json().items).toHaveLength(0);
    const bad = await h.call("GET", "/admin/legacy/records?table=users;drop", { session: owner });
    expect(bad.statusCode).toBe(400);
  });
});
