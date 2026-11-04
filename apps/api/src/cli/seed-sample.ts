/**
 * Development-only sample catalog: destinations, hotels with rooms, 90 days
 * of inventory and rates, and tours with departures. Every record is clearly
 * sample data; it refuses to run in production.
 *   npm run seed:sample -w @pegah/api
 */
import { addDays, dhakaToday } from "../common/time";
import { newPublicId } from "../common/ids";
import { cliDb, run } from "./cli-db";

if (process.env.NODE_ENV === "production") {
  console.error("seed:sample is for development databases only.");
  process.exit(2);
}

const db = cliDb();
const DAYS = 90;
const taka = (t: number) => BigInt(t) * 100n;

const destinations = [
  {
    slug: "sreemangal",
    name: "Sreemangal",
    nameBn: "শ্রীমঙ্গল",
    region: "Sylhet",
    summary: "Tea gardens, the Lawachara rain forest and the famous seven-layer tea.",
  },
  {
    slug: "coxs-bazar",
    name: "Cox's Bazar",
    nameBn: "কক্সবাজার",
    region: "Chattogram",
    summary: "The long sea beach, Himchari falls and fresh catch by the marine drive.",
  },
  {
    slug: "sundarbans",
    name: "Sundarbans",
    nameBn: "সুন্দরবন",
    region: "Khulna",
    summary: "Mangrove channels, river cruises and the home of the Bengal tiger.",
  },
  {
    slug: "bandarban",
    name: "Bandarban",
    nameBn: "বান্দরবান",
    region: "Chattogram",
    summary: "Cloud-top hills, Nilgiri viewpoints and indigenous villages.",
  },
];

const hotels = [
  {
    dest: "sreemangal",
    slug: "sample-tea-garden-resort",
    name: "Tea Garden Resort (sample)",
    stars: 4,
    sc: 1000,
    vat: 1500,
    rooms: [
      {
        name: "Garden Deluxe",
        adults: 2,
        children: 1,
        bed: "1 King",
        size: 32,
        rate: 8500,
        total: 6,
      },
      {
        name: "Family Cottage",
        adults: 4,
        children: 2,
        bed: "2 Queen",
        size: 55,
        rate: 14500,
        total: 3,
      },
    ],
  },
  {
    dest: "sreemangal",
    slug: "sample-lawachara-eco-lodge",
    name: "Lawachara Eco Lodge (sample)",
    stars: 3,
    sc: 0,
    vat: 1500,
    rooms: [
      {
        name: "Forest Room",
        adults: 2,
        children: 1,
        bed: "1 Queen",
        size: 24,
        rate: 4800,
        total: 8,
      },
    ],
  },
  {
    dest: "coxs-bazar",
    slug: "sample-marine-drive-hotel",
    name: "Marine Drive Hotel (sample)",
    stars: 5,
    sc: 1000,
    vat: 1500,
    rooms: [
      {
        name: "Sea View King",
        adults: 2,
        children: 1,
        bed: "1 King",
        size: 38,
        rate: 12500,
        total: 10,
      },
      {
        name: "Ocean Suite",
        adults: 3,
        children: 2,
        bed: "1 King + sofa",
        size: 70,
        rate: 26000,
        total: 2,
      },
    ],
  },
  {
    dest: "bandarban",
    slug: "sample-nilgiri-hill-stay",
    name: "Nilgiri Hill Stay (sample)",
    stars: 3,
    sc: 500,
    vat: 1500,
    rooms: [
      {
        name: "Cloud Deck Room",
        adults: 2,
        children: 0,
        bed: "1 Queen",
        size: 22,
        rate: 6200,
        total: 5,
      },
    ],
  },
];

const tours = [
  {
    dest: "sundarbans",
    slug: "sample-sundarbans-river-cruise",
    title: "Sundarbans River Cruise (sample)",
    days: 3,
    nights: 2,
    meeting: "Khulna launch ghat",
    group: 24,
    adult: 18500,
    child: 12000,
    vat: 500,
    highlights: ["Kotka and Kochikhali trails", "Dawn boat safari", "Forest department guide"],
    includes: ["Cabin on the boat", "All meals", "Park permits"],
    excludes: ["Travel to Khulna"],
  },
  {
    dest: "bandarban",
    slug: "sample-bandarban-hill-trek",
    title: "Bandarban Hill Trek (sample)",
    days: 4,
    nights: 3,
    meeting: "Bandarban bus stand",
    group: 12,
    adult: 14500,
    child: 9000,
    vat: 500,
    highlights: ["Nafakhum falls", "Thanchi river ride", "Village homestay"],
    includes: ["Guide and porter", "Homestay", "Meals on trek"],
    excludes: ["Personal gear"],
  },
];

void run(async () => {
  const today = dhakaToday();
  const destIds = new Map<string, bigint>();
  for (const [i, d] of destinations.entries()) {
    const row = await db.destination.upsert({
      where: { slug: d.slug },
      create: { ...d, status: "PUBLISHED", sortOrder: i },
      update: { ...d, status: "PUBLISHED", sortOrder: i },
    });
    destIds.set(d.slug, row.id);
  }

  for (const h of hotels) {
    const hotel = await db.hotel.upsert({
      where: { slug: h.slug },
      create: {
        publicId: newPublicId(),
        slug: h.slug,
        name: h.name,
        destinationId: destIds.get(h.dest)!,
        starRating: h.stars,
        addressLine: "Sample address — not a real property",
        summary: "Sample property for development. Not bookable.",
        cancellationPolicy: "Free cancellation until 3 days before check-in (sample policy).",
        serviceChargeBps: h.sc,
        vatBps: h.vat,
        status: "PUBLISHED",
      },
      update: { serviceChargeBps: h.sc, vatBps: h.vat, status: "PUBLISHED" },
    });
    for (const r of h.rooms) {
      const room = await db.hotelRoom.upsert({
        where: { hotelId_name: { hotelId: hotel.id, name: r.name } },
        create: {
          publicId: newPublicId(),
          hotelId: hotel.id,
          name: r.name,
          description: `${r.name} (sample)`,
          maxAdults: r.adults,
          maxChildren: r.children,
          bedType: r.bed,
          sizeSqm: r.size,
        },
        update: {},
      });
      const nights = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
      // Weekend nights (Thu, Fri in Bangladesh) cost 20% more.
      const rateFor = (d: Date) =>
        taka([4, 5].includes(d.getUTCDay()) ? Math.round(r.rate * 1.2) : r.rate);
      await db.roomInventory.createMany({
        data: nights.map((stayDate) => ({ roomId: room.id, stayDate, total: r.total })),
        skipDuplicates: true,
      });
      await db.roomRate.createMany({
        data: nights.map((stayDate) => ({
          roomId: room.id,
          stayDate,
          amountMinor: rateFor(stayDate),
        })),
        skipDuplicates: true,
      });
    }
  }

  for (const t of tours) {
    const tour = await db.tour.upsert({
      where: { slug: t.slug },
      create: {
        publicId: newPublicId(),
        slug: t.slug,
        destinationId: destIds.get(t.dest)!,
        title: t.title,
        summary: "Sample tour for development. Not bookable.",
        description: "Sample itinerary.",
        durationDays: t.days,
        durationNights: t.nights,
        meetingPoint: t.meeting,
        groupSizeMax: t.group,
        highlights: t.highlights,
        includes: t.includes,
        excludes: t.excludes,
        vatBps: t.vat,
        status: "PUBLISHED",
      },
      update: { status: "PUBLISHED" },
    });
    const existing = await db.tourSchedule.count({ where: { tourId: tour.id } });
    if (existing === 0) {
      // Weekly Thursday departures at 07:00 Dhaka (01:00 UTC).
      const firstThu = addDays(today, (4 - today.getUTCDay() + 7) % 7 || 7);
      await db.tourSchedule.createMany({
        data: Array.from({ length: 8 }, (_, w) => {
          const departsAt = new Date(addDays(firstThu, w * 7).getTime() + 60 * 60_000);
          return {
            publicId: newPublicId(),
            tourId: tour.id,
            departsAt,
            returnsAt: new Date(departsAt.getTime() + t.nights * 86_400_000 + 10 * 3_600_000),
            capacity: t.group,
            priceAdultMinor: taka(t.adult),
            priceChildMinor: taka(t.child),
          };
        }),
      });
    }
  }
  console.warn(
    `Sample catalog ready: ${destinations.length} destinations, ${hotels.length} hotels, ${tours.length} tours.`,
  );
}, db);
