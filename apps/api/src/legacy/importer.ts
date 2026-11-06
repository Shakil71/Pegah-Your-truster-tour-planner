/**
 * Old Pegah website → this database (ADR-0038). Used by cli/import-legacy.ts.
 *
 * Safety:
 *  - Reads the dump as text; never executes its SQL.
 *  - Additive only: creates rows, never updates or deletes existing ones.
 *    Re-running skips everything already imported (legacy_records is the ledger).
 *  - Hotels, tours, packages, destinations and pages arrive as DRAFT; staff
 *    review prices, photos and text before publishing.
 *  - Every source row (except sessions, OTP codes, queue tables and
 *    credentials) is kept verbatim in legacy_records, so no field is lost.
 *  - Catalog rows and the ledger are written in one transaction: a failure
 *    leaves the database exactly as it was. Photos are stored first (shared,
 *    de-duplicated by content hash; harmless if a later step fails).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "@pegah/db";
import { newPublicId } from "../common/ids";
import {
  clip,
  dhakaToUtc,
  htmlToList,
  htmlToText,
  int,
  mapUrl,
  slugify,
  takaToMinor,
  toHhMm,
  type Dump,
  type DumpRow,
} from "./sql-dump";

type Tx = Prisma.TransactionClient;
/** Operator output (CLI report); not application logging. */
const out = (line: string) =>
  void process.stdout.write(`${line}
`);

/** Not imported at all: login sessions, one-time codes, framework queues. */
export const SKIP_TABLES = new Set([
  "sessions",
  "otp_sent_mobiles",
  "password_resets",
  "jobs",
  "failed_jobs",
  "migrations",
]);
/** Never copied into the archive (credentials and identity numbers). */
export const SECRET_FIELDS = new Set([
  "password",
  "remember_token",
  "session_id",
  "otp_code",
  "national_id",
  "passport_number",
]);

interface Place {
  slug: string;
  name: string;
  nameBn?: string;
  region: string;
}
const PLACES: Array<Place & { aliases: string[] }> = [
  {
    slug: "coxs-bazar",
    name: "Cox's Bazar",
    nameBn: "কক্সবাজার",
    region: "Chattogram",
    aliases: ["cox's bazar", "coxs bazar"],
  },
  {
    slug: "saint-martin",
    name: "Saint Martin's Island",
    nameBn: "সেন্টমার্টিন",
    region: "Chattogram",
    aliases: [
      "saint martin",
      "sain't martin",
      "saint martin iceland",
      "st. martin island",
      "st martin",
    ],
  },
  {
    slug: "sajek",
    name: "Sajek Valley",
    nameBn: "সাজেক",
    region: "Chattogram",
    aliases: ["sajek", "sajek valley", "sajek valley bandarban"],
  },
  { slug: "sylhet", name: "Sylhet", nameBn: "সিলেট", region: "Sylhet", aliases: ["sylhet"] },
  { slug: "rangpur", name: "Rangpur", nameBn: "রংপুর", region: "Rangpur", aliases: ["rangpur"] },
  {
    slug: "rajshahi",
    name: "Rajshahi",
    nameBn: "রাজশাহী",
    region: "Rajshahi",
    aliases: ["rajshahi"],
  },
  { slug: "ranibazar", name: "Ranibazar", region: "Rajshahi", aliases: ["ranibazar"] },
  { slug: "dhaka", name: "Dhaka", nameBn: "ঢাকা", region: "Dhaka", aliases: ["dhaka"] },
  { slug: "gazipur", name: "Gazipur", nameBn: "গাজীপুর", region: "Dhaka", aliases: ["gazipur"] },
  {
    slug: "chattogram",
    name: "Chattogram",
    nameBn: "চট্টগ্রাম",
    region: "Chattogram",
    aliases: ["chittagong", "chottagram", "chattogram"],
  },
  {
    slug: "rangamati",
    name: "Rangamati",
    nameBn: "রাঙ্গামাটি",
    region: "Chattogram",
    aliases: ["rangamati"],
  },
  {
    slug: "bandarban",
    name: "Bandarban",
    nameBn: "বান্দরবান",
    region: "Chattogram",
    aliases: ["bandarban"],
  },
  {
    slug: "alikadam",
    name: "Alikadam",
    nameBn: "আলীকদম",
    region: "Chattogram",
    aliases: ["alikodom", "alikadam"],
  },
  {
    slug: "kuakata",
    name: "Kuakata",
    nameBn: "কুয়াকাটা",
    region: "Barishal",
    aliases: ["kuakata"],
  },
  {
    slug: "sundarbans",
    name: "Sundarbans",
    nameBn: "সুন্দরবন",
    region: "Khulna",
    aliases: ["sundarban forest", "sundarbans", "sundarban"],
  },
  {
    slug: "tanguar-haor",
    name: "Tanguar Haor",
    nameBn: "টাঙ্গুয়ার হাওর",
    region: "Sylhet",
    aliases: ["sunamganj, tahirpur", "tanguar haor"],
  },
  {
    slug: "ratargul",
    name: "Ratargul Swamp Forest",
    nameBn: "রাতারগুল",
    region: "Sylhet",
    aliases: ["ratargul swamp forest", "ratargul"],
  },
  {
    slug: "bichnakandi",
    name: "Bichnakandi",
    nameBn: "বিছানাকান্দি",
    region: "Sylhet",
    aliases: ["bichnakandi"],
  },
  {
    slug: "bangladesh",
    name: "Across Bangladesh",
    nameBn: "সারা বাংলাদেশ",
    region: "Bangladesh",
    aliases: ["preferred place"],
  },
];
function placeFor(raw: string | null | undefined): Place | null {
  const key = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return PLACES.find((p) => p.aliases.includes(key)) ?? null;
}

const PROPERTY_TYPES: Record<string, string> = {
  hotel: "HOTEL",
  resort: "RESORT",
  "hotel & resort": "HOTEL_RESORT",
};

function sqftToSqm(raw: string | null): number | null {
  const n = int(raw, 100000);
  if (!n) return null;
  const sqm = /m2|sqm|square met/i.test(raw ?? "") ? n : Math.round(n * 0.092903);
  return sqm > 0 && sqm <= 65535 ? sqm : null;
}

export class Report {
  readonly counts = new Map<string, number>();
  readonly notes: string[] = [];
  add(key: string, n = 1) {
    this.counts.set(key, (this.counts.get(key) ?? 0) + n);
  }
  print(dryRun: boolean) {
    out(dryRun ? "\nDRY RUN — nothing was written.\n" : "\nImport finished.\n");
    for (const [k, v] of [...this.counts].sort()) out(`  ${k.padEnd(34)} ${v}`);
    if (this.notes.length) {
      out("\nNotes:");
      for (const n of this.notes) out(`  - ${n}`);
    }
  }
}

/** Imports a parsed dump. With dryRun, everything is checked and nothing is written. */
export async function importLegacy(
  db: PrismaClient,
  dump: Dump,
  imagesDir: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<Report> {
  for (const t of ["hotels", "hotel_rooms", "tours", "users"]) {
    if (!dump[t]) throw new Error(`The dump has no ${t} table; is this the old Pegah database?`);
  }
  const report = new Report();
  const media = await storePhotos(db, dump, imagesDir, dryRun, report);
  try {
    await db.$transaction(
      async (tx) => {
        await importAll(tx, dump, media, report);
        if (dryRun) throw new DryRunDone();
      },
      { timeout: 600_000, maxWait: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof DryRunDone)) throw error;
  }
  return report;
}

class DryRunDone extends Error {}

// ─── Photos ──────────────────────────────────────────────────────────────────

interface PhotoRef {
  file: string;
  alt: string;
  credit: string;
}

/** Stores every referenced photo once (WebP, ≤2000 px, metadata stripped). Returns file → media id. */
async function storePhotos(
  db: PrismaClient,
  dump: Dump,
  imagesDir: string,
  dryRun: boolean,
  report: Report,
): Promise<Map<string, bigint | null>> {
  const refs = new Map<string, PhotoRef>();
  const hotels = byId(dump.hotels);
  const tours = byId(dump.tours);
  const rooms = byId(dump.hotel_rooms);
  const packages = byId(dump.packages);
  const supplier = (name: string) => `Provided by ${name} (old Pegah website)`;
  const want = (file: string | null | undefined, alt: string, credit: string) => {
    if (file && !refs.has(file))
      refs.set(file, { file, alt: clip(alt, 250), credit: clip(credit, 250) });
  };
  for (const h of dump.hotels ?? [])
    want(h.image, `${h.name} — hotel`, supplier(h.name ?? "the hotel"));
  for (const i of dump.hotel_images ?? []) {
    const h = hotels.get(i.hotel_id!);
    want(i.image, `${h?.name ?? "Hotel"} — photo`, supplier(h?.name ?? "the hotel"));
  }
  for (const i of dump.hotel_room_images ?? []) {
    const r = rooms.get(i.hotel_room_id!);
    const h = r ? hotels.get(r.hotel_id!) : undefined;
    want(
      i.image,
      `${h?.name ?? "Hotel"} — ${r?.room_name ?? "room"}`,
      supplier(h?.name ?? "the hotel"),
    );
  }
  for (const i of dump.tour_images ?? []) {
    want(
      i.image,
      `${tours.get(i.tour_id!)?.title ?? "Tour"} — photo`,
      "Pegah (old website); verify the source before publishing",
    );
  }
  for (const i of dump.package_images ?? []) {
    want(
      i.image,
      `${packages.get(i.package_id!)?.title ?? "Package"} — photo`,
      "Pegah (old website); verify the source before publishing",
    );
  }
  for (const s of dump.tourist_spots ?? [])
    want(
      s.image,
      `${s.name} — destination`,
      "Pegah (old website); verify the source before publishing",
    );
  for (const t of ["hotel_facilities", "room_facilities", "tour_facilities"]) {
    for (const f of dump[t] ?? []) want(f.icon, `${f.facility_name} icon`, "Pegah (old website)");
  }

  const stored = new Map<string, bigint | null>();
  let n = 0;
  for (const ref of refs.values()) {
    n++;
    const full = path.join(imagesDir, ref.file.replace(/^\/?(assets\/)?images\//, ""));
    if (!existsSync(full)) {
      report.add("photos missing in folder");
      report.notes.push(`Photo not found: ${ref.file}`);
      continue;
    }
    let output: { data: Buffer; info: sharp.OutputInfo };
    try {
      output = await sharp(readFileSync(full), { failOn: "error", limitInputPixels: 50_000_000 })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      report.add("photos unreadable");
      report.notes.push(`Photo could not be read: ${ref.file}`);
      continue;
    }
    if (dryRun) {
      stored.set(ref.file, null);
      report.add("photos ready");
      continue;
    }
    const storageKey = `${createHash("sha256").update(output.data).digest("hex").slice(0, 24)}.webp`;
    const existing = await db.mediaAsset.findUnique({
      where: { storageKey },
      select: { id: true },
    });
    if (existing) {
      stored.set(ref.file, existing.id);
      report.add("photos already stored");
      continue;
    }
    const row = await db.mediaAsset.create({
      data: {
        storageKey,
        altText: ref.alt,
        credit: ref.credit,
        license: "Old website; verify before publishing",
        width: output.info.width,
        height: output.info.height,
        byteSize: output.data.length,
        blob: { create: { mime: "image/webp", bytes: new Uint8Array(output.data) } },
      },
      select: { id: true },
    });
    stored.set(ref.file, row.id);
    report.add("photos stored");
    if (n % 100 === 0) out(`  photos: ${n}/${refs.size}`);
  }
  return stored;
}

// ─── Catalog, customers and archive ──────────────────────────────────────────

function byId(rows: DumpRow[] | undefined): Map<string, DumpRow> {
  return new Map((rows ?? []).map((r) => [r.id!, r]));
}
function groupBy(rows: DumpRow[] | undefined, key: string): Map<string, DumpRow[]> {
  const m = new Map<string, DumpRow[]>();
  for (const r of rows ?? []) {
    const k = r[key];
    if (k == null) continue;
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
}
const sourceId = (table: string, r: DumpRow) =>
  r.id ??
  createHash("sha256")
    .update(`${table}:${JSON.stringify(r)}`)
    .digest("hex")
    .slice(0, 32);

async function importAll(tx: Tx, dump: Dump, media: Map<string, bigint | null>, report: Report) {
  // Ledger of what was already imported (re-runs skip those rows).
  const ledger = new Map<string, { targetType: string | null; targetId: bigint | null }>();
  for (const r of await tx.legacyRecord.findMany({
    select: { sourceTable: true, sourceId: true, targetType: true, targetId: true },
  })) {
    ledger.set(`${r.sourceTable}:${r.sourceId}`, {
      targetType: r.targetType,
      targetId: r.targetId,
    });
  }
  const links = new Map<string, { targetType: string; targetId: bigint }>();
  const link = (table: string, id: string, targetType: string, targetId: bigint) =>
    links.set(`${table}:${id}`, { targetType, targetId });
  const imported = (table: string, id: string) => ledger.get(`${table}:${id}`)?.targetId ?? null;
  const mediaId = (file: string | null | undefined) => (file ? (media.get(file) ?? null) : null);

  const charges = dump.hotel_charges?.[0];
  const vatBps = Math.round(Number(charges?.vat ?? 0) * 100) || 0;
  const serviceBps = Math.round(Number(charges?.service_charge ?? 0) * 100) || 0;

  // Destinations ----------------------------------------------------------
  const spots = new Map((dump.tourist_spots ?? []).map((s) => [placeFor(s.name)?.slug, s]));
  const destIds = new Map<string, bigint>();
  async function destination(place: Place): Promise<bigint> {
    const known = destIds.get(place.slug);
    if (known) return known;
    const spot = spots.get(place.slug);
    const found = await tx.destination.findUnique({ where: { slug: place.slug } });
    let id: bigint;
    if (found) {
      id = found.id;
      if (!found.description && spot) {
        await tx.destination.update({
          where: { id },
          data: { description: htmlToText(spot.description) },
        });
      }
      report.add("destinations reused");
    } else {
      const text = htmlToText(spot?.description);
      const row = await tx.destination.create({
        data: {
          slug: place.slug,
          name: place.name,
          nameBn: place.nameBn ?? null,
          region: place.region,
          summary: text ? clip(text, 480) : `${place.name}, ${place.region}, Bangladesh.`,
          description: text || null,
          heroMediaId: mediaId(spot?.image),
          status: "DRAFT",
        },
      });
      id = row.id;
      report.add("destinations created");
    }
    destIds.set(place.slug, id);
    return id;
  }
  const cityPlace = new Map<string, Place>();
  for (const c of dump.cities ?? []) {
    const p = placeFor(c.city_name);
    if (!p)
      report.notes.push(
        `City "${c.city_name}" has no destination mapping; kept in the archive only.`,
      );
    else {
      cityPlace.set(c.id!, p);
      link("cities", c.id!, "destination", await destination(p));
    }
  }
  const tourCityPlace = new Map<string, Place>();
  for (const c of dump.tour_cities ?? []) {
    const p = placeFor(c.city_name);
    if (!p) report.notes.push(`Tour city "${c.city_name}" has no destination mapping.`);
    else {
      tourCityPlace.set(c.id!, p);
      link("tour_cities", c.id!, "destination", await destination(p));
    }
  }
  for (const s of dump.tourist_spots ?? []) {
    const p = placeFor(s.name);
    if (p) link("tourist_spots", s.id!, "destination", await destination(p));
  }

  // Amenities -------------------------------------------------------------
  const facilityTypes = byId(dump.facility_types);
  const amenityIds = new Map<string, bigint>();
  async function amenity(scope: "HOTEL" | "ROOM" | "TOUR", table: string, f: DumpRow) {
    const slug = slugify(f.facility_name ?? `item-${f.id}`);
    const existing = await tx.amenity.findUnique({ where: { scope_slug: { scope, slug } } });
    const row =
      existing ??
      (await tx.amenity.create({
        data: {
          scope,
          slug,
          name: clip(htmlToText(f.facility_name) || slug, 120),
          groupName: f.facility_type_id
            ? (facilityTypes.get(f.facility_type_id)?.type_name ?? null)
            : null,
          iconMediaId: mediaId(f.icon),
        },
      }));
    if (!existing) report.add(`amenities created (${scope.toLowerCase()})`);
    amenityIds.set(`${table}:${f.id}`, row.id);
    link(table, f.id!, "amenity", row.id);
  }
  for (const f of dump.hotel_facilities ?? []) await amenity("HOTEL", "hotel_facilities", f);
  for (const f of dump.room_facilities ?? []) await amenity("ROOM", "room_facilities", f);
  for (const f of dump.tour_facilities ?? []) await amenity("TOUR", "tour_facilities", f);

  // Hotels and rooms ------------------------------------------------------
  const hotelTypes = byId(dump.hotel_types);
  const roomTypes = byId(dump.room_types);
  const nearby = groupBy(dump.hotel_nearby_places, "hotel_id");
  const hotelImages = groupBy(dump.hotel_images, "hotel_id");
  const hotelFacilities = groupBy(dump.hotel_facility_pairs, "hotel_id");
  const roomsByHotel = groupBy(dump.hotel_rooms, "hotel_id");
  const roomImages = groupBy(dump.hotel_room_images, "hotel_room_id");
  const roomFacilities = groupBy(dump.hotel_room_facility_pairs, "hotel_room_id");

  async function freeSlug(model: "hotel" | "tour" | "offer", base: string): Promise<string> {
    const find = (slug: string) =>
      model === "hotel"
        ? tx.hotel.findUnique({ where: { slug }, select: { id: true } })
        : model === "tour"
          ? tx.tour.findUnique({ where: { slug }, select: { id: true } })
          : tx.offer.findUnique({ where: { slug }, select: { id: true } });
    let slug = slugify(base, 76);
    for (let n = 2; await find(slug); n++) slug = `${slugify(base, 72)}-${n}`;
    return slug;
  }

  for (const h of dump.hotels ?? []) {
    if (imported("hotels", h.id!)) {
      report.add("hotels already imported");
      continue;
    }
    const place = cityPlace.get(h.city_id ?? "");
    const destinationId = place
      ? await destination(place)
      : await destination(placeFor("preferred place")!);
    const details = htmlToText(h.hotel_details);
    const name = clip(htmlToText(h.name), 160);
    const childPolicy = [h.child_policy, htmlToText(h.child_rules)].filter(Boolean).join("\n\n");
    const gallery = (hotelImages.get(h.id!) ?? [])
      .map((i) => mediaId(i.image))
      .filter((x): x is bigint => !!x);
    const hero = mediaId(h.image) ?? gallery[0] ?? null;
    const hotel = await tx.hotel.create({
      data: {
        publicId: newPublicId(),
        slug: await freeSlug("hotel", h.slug || name),
        destinationId,
        name,
        addressLine: clip(htmlToText(h.address) || place?.name || "Bangladesh", 255),
        summary: details ? clip(details, 480) : `${name}, ${place?.name ?? "Bangladesh"}.`,
        description: details || null,
        checkInTime: toHhMm(h.check_in_time) ?? "14:00",
        checkOutTime: toHhMm(h.check_out_time) ?? "12:00",
        cancellationPolicy:
          clip(htmlToText(h.cancellation_policy), 500) ||
          "Ask Pegah for this hotel's cancellation policy before booking.",
        currency: "BDT",
        vatBps,
        serviceChargeBps: serviceBps,
        heroMediaId: hero,
        status: "DRAFT",
        propertyType:
          PROPERTY_TYPES[(hotelTypes.get(h.type_id ?? "")?.type_name ?? "").toLowerCase()] ?? null,
        phone: clip([h.mobile, h.phone].filter(Boolean).join(", "), 40) || null,
        email: h.email?.trim() || null,
        mapUrl: mapUrl(h.map_link),
        distanceFromCity: h.distance_from_city ? clip(htmlToText(h.distance_from_city), 120) : null,
        distanceFromSpot: h.distance_from_spot ? clip(htmlToText(h.distance_from_spot), 160) : null,
        floors: int(h.number_of_floors),
        roomCount: int(h.number_of_rooms),
        childPolicy: childPolicy || null,
        petPolicy: h.pet_policy ? clip(h.pet_policy, 255) : null,
        houseRules: htmlToText(h.house_rules) || null,
        breakfast: h.breakfast ? clip(h.breakfast, 120) : null,
        specialNote: htmlToText(h.special_note) || null,
        nearbyPlaces: (nearby.get(h.id!) ?? [])
          .map((p) => htmlToText(p.place_name))
          .filter(Boolean),
        sortOrder: Number(h.sorting_serial) || 0,
      },
    });
    link("hotels", h.id!, "hotel", hotel.id);
    report.add("hotels created (draft)");
    let order = 0;
    for (const m of new Set(gallery)) {
      await tx.hotelMedia.create({ data: { hotelId: hotel.id, mediaId: m, sortOrder: order++ } });
    }
    for (const pair of hotelFacilities.get(h.id!) ?? []) {
      const a = amenityIds.get(`hotel_facilities:${pair.hotel_facility_id}`);
      if (a)
        await tx.hotelAmenity.upsert({
          where: { hotelId_amenityId: { hotelId: hotel.id, amenityId: a } },
          create: { hotelId: hotel.id, amenityId: a },
          update: {},
        });
    }

    const usedNames = new Set<string>();
    for (const r of roomsByHotel.get(h.id!) ?? []) {
      let roomName = clip(htmlToText(r.room_name) || "Room", 110);
      for (let n = 2; usedNames.has(roomName.toLowerCase()); n++)
        roomName = `${clip(htmlToText(r.room_name) || "Room", 104)} (${n})`;
      usedNames.add(roomName.toLowerCase());
      const roomDetails = htmlToText(r.room_details);
      const regular = takaToMinor(r.regular_price);
      const discount = takaToMinor(r.discount_price);
      const beds = {
        total: r.total_bed ?? null,
        single: int(r.total_single_bed, 50),
        double: int(r.total_double_bed, 50),
        triple: int(r.total_triple_bed, 50),
      };
      const room = await tx.hotelRoom.create({
        data: {
          publicId: newPublicId(),
          hotelId: hotel.id,
          name: roomName,
          description: roomDetails ? clip(roomDetails, 480) : roomName,
          maxAdults: Math.min(int(r.adult_capacity, 30) ?? 2, 30),
          maxChildren: Math.min(Number(r.child_capacity) || 0, 20),
          bedType: clip(
            /^\d+$/.test(r.total_bed ?? "")
              ? `${r.total_bed} bed${r.total_bed === "1" ? "" : "s"}`
              : htmlToText(r.total_bed) || "See room details",
            60,
          ),
          sizeSqm: sqftToSqm(r.room_size),
          isActive: r.status === "1",
          roomType: roomTypes.get(r.room_type ?? "")?.type_name ?? r.room_type ?? null,
          roomNumber: r.room_number ? clip(r.room_number, 40) : null,
          floor: r.floor ? clip(r.floor, 40) : null,
          details: roomDetails || null,
          note: r.additional_note ? clip(htmlToText(r.additional_note), 255) : null,
          sizeLabel: r.room_size ? clip(r.room_size, 40) : null,
          beds,
          airConditioned:
            r.air_condition === "Yes" ? true : r.air_condition === "No" ? false : null,
          units: int(r.quantity),
          extraBeds: Math.min(Number(r.extra_bed_capacity) || 0, 255),
          extraBedPriceMinor: takaToMinor(r.extra_bed_price),
          rackRateMinor: regular,
          discountRateMinor: discount && discount > 0n ? discount : null,
        },
      });
      link("hotel_rooms", r.id!, "hotel_room", room.id);
      report.add("rooms created");
      let o = 0;
      const seen = new Set<bigint>();
      for (const i of roomImages.get(r.id!) ?? []) {
        const m = mediaId(i.image);
        if (m && !seen.has(m)) {
          seen.add(m);
          await tx.roomMedia.create({ data: { roomId: room.id, mediaId: m, sortOrder: o++ } });
        }
      }
      for (const pair of roomFacilities.get(r.id!) ?? []) {
        const a = amenityIds.get(`room_facilities:${pair.room_facility_id}`);
        if (a)
          await tx.roomAmenity.upsert({
            where: { roomId_amenityId: { roomId: room.id, amenityId: a } },
            create: { roomId: room.id, amenityId: a },
            update: {},
          });
      }
    }
  }

  // Tours -----------------------------------------------------------------
  const tourTypes = byId(dump.tour_types);
  const tags = byId(dump.tour_tags);
  const vehicles = byId(dump.tour_vichles);
  const tourImages = groupBy(dump.tour_images, "tour_id");
  const tourTags = groupBy(dump.tour_tag_pairs, "tour_id");
  const tourVehicles = groupBy(dump.tour_vichle_pairs, "tour_id");
  const tourPickups = groupBy(dump.tour_pickup_locations, "tour_id");
  const tourFacilities = groupBy(dump.tour_facility_pairs, "tour_id");
  for (const t of dump.tours ?? []) {
    if (imported("tours", t.id!)) {
      report.add("tours already imported");
      continue;
    }
    const place =
      tourCityPlace.get(t.city_id ?? "") ?? placeFor(t.location) ?? placeFor("preferred place")!;
    const title = clip(htmlToText(t.title), 160);
    const description = htmlToText(t.description) || htmlToText(t.overview) || title;
    const pickups = [
      ...(tourPickups.get(t.id!) ?? []).map((p) => htmlToText(p.pickup_location)),
      ...htmlToList(t.pick_up_location),
    ].filter(Boolean);
    const transport = [
      htmlToText(t.vichle_info),
      ...(tourVehicles.get(t.id!) ?? []).map((v) => {
        const veh = vehicles.get(v.tour_vichle_id ?? "");
        return veh ? `• ${veh.vichle_name} (${veh.seat} seats)` : "";
      }),
    ]
      .filter(Boolean)
      .join("\n");
    const gallery = [
      ...new Set(
        (tourImages.get(t.id!) ?? []).map((i) => mediaId(i.image)).filter((x): x is bigint => !!x),
      ),
    ];
    const list = takaToMinor(t.price);
    const sale = takaToMinor(t.discount_price);
    const tour = await tx.tour.create({
      data: {
        publicId: newPublicId(),
        slug: await freeSlug("tour", t.slug || title),
        destinationId: await destination(place),
        title,
        summary: clip(htmlToText(t.overview) || description, 480),
        description,
        durationDays: Math.min(int(t.day, 60) ?? 1, 60),
        durationNights: Math.min(Number(t.night) || 0, 60),
        meetingPoint: clip(pickups[0] ?? htmlToText(t.location) ?? place.name, 255) || place.name,
        groupSizeMax: int(t.max_capacity, 999) ?? int(t.capacity, 999) ?? 20,
        highlights: htmlToList(t.highlights),
        includes: htmlToList(t.inclusion),
        excludes: [],
        currency: "BDT",
        heroMediaId: gallery[0] ?? null,
        status: "DRAFT",
        tourType: tourTypes.get(t.type_id ?? "")?.type_name ?? null,
        overview: htmlToText(t.overview) || null,
        itinerary: htmlToText(t.itinerary) || null,
        policy: htmlToText(t.policy) || null,
        cancellationPolicy: htmlToText(t.cancellation_policy) || null,
        travelTips: htmlToText(t.travel_tips) || null,
        additionalInfo: htmlToText(t.additional_information) || null,
        timing: t.timing ? clip(htmlToText(t.timing), 120) : null,
        transport: transport || null,
        pickupPoints: pickups,
        tags: (tourTags.get(t.id!) ?? [])
          .map((p) => tags.get(p.tour_tag_id ?? "")?.tag_name)
          .filter(Boolean) as string[],
        mapUrl: mapUrl(t.map_link),
        minAdults: int(t.min_adult, 255),
        bookingCutoffDays: int(t.booking_before),
        listPriceMinor: list,
        salePriceMinor: sale && sale > 0n ? sale : null,
      },
    });
    link("tours", t.id!, "tour", tour.id);
    report.add("tours created (draft)");
    let o = 0;
    for (const m of gallery)
      await tx.tourMedia.create({ data: { tourId: tour.id, mediaId: m, sortOrder: o++ } });
    for (const pair of tourFacilities.get(t.id!) ?? []) {
      const a = amenityIds.get(`tour_facilities:${pair.tour_facility_id}`);
      if (a)
        await tx.tourAmenity.upsert({
          where: { tourId_amenityId: { tourId: tour.id, amenityId: a } },
          create: { tourId: tour.id, amenityId: a },
          update: {},
        });
    }
  }

  // Packages (Umrah, corporate) → offers ------------------------------------
  const packageTypes = byId(dump.package_types);
  const packageImages = groupBy(dump.package_images, "package_id");
  for (const p of dump.packages ?? []) {
    if (imported("packages", p.id!)) {
      report.add("packages already imported");
      continue;
    }
    const title = clip(htmlToText(p.title), 160);
    const sections: Array<[string, string | null]> = [
      ["", p.details],
      ["Inclusions and exclusions", p.inclusion_exclusion],
      ["Itinerary", p.itinerary],
      ["Policy", p.policy],
      ["Questions", p.faq],
      ["Remarks", p.remarks],
      ["Contact", p.contact],
    ];
    const details = sections
      .map(([h, html]) => {
        const text = htmlToText(html);
        return text ? (h ? `## ${h}\n\n${text}` : text) : "";
      })
      .filter(Boolean)
      .join("\n\n");
    const summary = clip(htmlToText(p.short_info) || `${title} — ${p.location ?? ""}`, 300);
    const gallery = [
      ...new Set(
        (packageImages.get(p.id!) ?? [])
          .map((i) => mediaId(i.image))
          .filter((x): x is bigint => !!x),
      ),
    ];
    const price = takaToMinor(p.start_from);
    const offer = await tx.offer.create({
      data: {
        publicId: newPublicId(),
        slug: await freeSlug("offer", p.slug || title),
        titleEn: title,
        // Bangla copy is written by staff before publishing.
        titleBn: title,
        summaryEn: summary,
        summaryBn: summary,
        detailsEn: details || summary,
        detailsBn: details || summary,
        priceMinor: price ?? 0n,
        heroMediaId: gallery[0] ?? null,
        status: "DRAFT",
        sortOrder: Number(p.sorting_serial) || 0,
      },
    });
    if (!price)
      report.notes.push(`Package "${title}" has no readable price; set it before publishing.`);
    report.notes.push(
      `Package "${title}" (${packageTypes.get(p.type_id ?? "")?.name ?? "package"}) is a draft offer with the English text in the Bangla fields too.`,
    );
    link("packages", p.id!, "offer", offer.id);
    report.add("packages → offers (draft)");
    let o = 0;
    for (const m of gallery)
      await tx.offerMedia.create({ data: { offerId: offer.id, mediaId: m, sortOrder: o++ } });
  }

  // Customers -------------------------------------------------------------
  const seenEmails = new Map<string, bigint>();
  for (const u of dump.users ?? []) {
    if (imported("users", u.id!)) {
      report.add("customers already imported");
      continue;
    }
    const email = u.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      report.add("customers without email (archive only)");
      continue;
    }
    const existing =
      seenEmails.get(email) ??
      (await tx.user.findUnique({ where: { email }, select: { id: true } }))?.id ??
      null;
    if (existing) {
      // Same person (duplicate row) or an account that already exists here: link, never overwrite.
      link("users", u.id!, "user", existing);
      report.add("customers linked to existing accounts");
      continue;
    }
    const hash = u.password && /^\$2[aby]\$\d{2}\$.{53}$/.test(u.password) ? u.password : null;
    const created = dhakaToUtc(u.created_at) ?? new Date();
    const user = await tx.user.create({
      data: {
        publicId: newPublicId(),
        email,
        // Old bcrypt hash: verified once at sign-in, then upgraded to Argon2id.
        // Without one, the account can only be used after "Forgot password".
        passwordHash: hash ?? "!legacy-no-password",
        fullName: clip(htmlToText(u.name) || email.split("@")[0]!, 120),
        phone: u.mobile ? clip(u.mobile.replace(/[^\d+]/g, ""), 20) || null : null,
        kind: "CUSTOMER",
        status: u.status === "1" ? "ACTIVE" : "DISABLED",
        emailVerifiedAt: dhakaToUtc(u.email_verified_at),
        createdAt: created,
      },
    });
    seenEmails.set(email, user.id);
    link("users", u.id!, "user", user.id);
    report.add("customers created");
  }

  // Coupons → paused promotions ---------------------------------------------
  for (const c of dump.coupons ?? []) {
    if (imported("coupons", c.id!)) continue;
    const code = (c.coupon_code ?? "").trim().toUpperCase().slice(0, 40);
    if (!code) continue;
    const found = await tx.promotion.findUnique({ where: { code }, select: { id: true } });
    if (found) {
      link("coupons", c.id!, "promotion", found.id);
      continue;
    }
    const pct = Number(c.discount);
    const percent = c.discount_type === "2";
    const starts = dhakaToUtc(c.start_date) ?? new Date();
    const ends = dhakaToUtc(c.end_date) ?? starts;
    const promo = await tx.promotion.create({
      data: {
        publicId: newPublicId(),
        code,
        name: `${code} (old website)`,
        kind: percent ? "PERCENT" : "FIXED",
        percentBps: percent ? Math.min(Math.round(pct * 100), 10000) : null,
        amountMinor: percent ? null : takaToMinor(c.discount),
        minSpendMinor: takaToMinor(c.minimum_cost) ?? 0n,
        maxDiscountMinor: takaToMinor(c.up_to),
        startsAt: starts,
        endsAt: ends > starts ? ends : new Date(starts.getTime() + 1000),
        maxRedemptions: null,
        perCustomerLimit: Math.max(1, Math.min(int(c.used_limit) ?? 1, 1000)),
        status: "PAUSED",
      },
    });
    link("coupons", c.id!, "promotion", promo.id);
    report.add("coupons → promotions (paused)");
  }

  // Pages -----------------------------------------------------------------
  const pages: Array<[string, string, string, string | null | undefined]> = [
    ["privacy_policies", "privacy", "Privacy policy", dump.privacy_policies?.[0]?.privacy_policies],
    [
      "terms_conditions",
      "terms",
      "Terms and conditions",
      dump.terms_conditions?.[0]?.terms_conditions,
    ],
    ["about_us", "about-old-website", "About Pegah (old website)", dump.about_us?.[0]?.about_us],
  ];
  for (const [table, slug, title, html] of pages) {
    const id = dump[table]?.[0]?.id;
    const body = htmlToText(html);
    if (!id || !body || imported(table, id)) continue;
    const taken = await tx.contentPage.findUnique({ where: { slug }, select: { id: true } });
    const finalSlug = taken ? `${slug}-old-website` : slug;
    if (taken && (await tx.contentPage.findUnique({ where: { slug: finalSlug } }))) continue;
    const page = await tx.contentPage.create({
      data: { slug: finalSlug, title, summary: clip(body, 290), body, status: "DRAFT" },
    });
    link(table, id, "content_page", page.id);
    report.add("pages created (draft)");
  }

  // Archive: every row of every table ----------------------------------------
  const rows: Prisma.LegacyRecordCreateManyInput[] = [];
  for (const [table, list] of Object.entries(dump)) {
    if (SKIP_TABLES.has(table)) {
      report.add(`skipped rows (${table})`, list.length);
      continue;
    }
    for (const r of list) {
      const id = sourceId(table, r);
      const key = `${table}:${id}`;
      const target = links.get(key);
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(r)) if (!SECRET_FIELDS.has(k)) payload[k] = v;
      if (ledger.has(key)) {
        const prev = ledger.get(key)!;
        if (target && !prev.targetId) {
          await tx.legacyRecord.update({
            where: { sourceTable_sourceId: { sourceTable: table, sourceId: id } },
            data: { targetType: target.targetType, targetId: target.targetId },
          });
        }
        continue;
      }
      rows.push({
        sourceTable: table.slice(0, 64),
        sourceId: id,
        payload,
        targetType: target?.targetType ?? null,
        targetId: target?.targetId ?? null,
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await tx.legacyRecord.createMany({ data: rows.slice(i, i + 500) });
  }
  report.add("archive rows written", rows.length);
}
