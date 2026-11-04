/**
 * Demo catalog: destinations, hotels with rooms, 120 days of inventory and
 * rates, and tours with weekly departures. Every hotel and tour is labelled
 * "(Demo)" and its slug starts with "demo-", so it can never be mistaken for a
 * real listing and can be removed in one command.
 *
 *   npm run seed:sample -w @pegah/api                      # development
 *   NODE_ENV=production … seed-sample.js --demo            # pre-launch server (owner-approved)
 *   … seed-sample.js --demo --remove                       # delete all demo listings and their bookings
 *
 * Payment is not live, so no demo booking can ever become CONFIRMED.
 */
import { addDays, dhakaToday } from "../common/time";
import { newPublicId } from "../common/ids";
import { cliDb, run } from "./cli-db";

const flag = (name: string) => process.argv.includes(`--${name}`);
if (process.env.NODE_ENV === "production" && !flag("demo")) {
  console.error("Refusing to seed a production database without --demo (owner approval required).");
  process.exit(2);
}

const db = cliDb();
const DAYS = 120;
const DEMO = " (Demo)";
const taka = (t: number) => BigInt(t) * 100n;

const destinations = [
  {
    slug: "srimangal",
    name: "Srimangal",
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
    dest: "srimangal",
    slug: "demo-tea-garden-resort",
    name: "Tea Garden Resort",
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
    dest: "srimangal",
    slug: "demo-lawachara-eco-lodge",
    name: "Lawachara Eco Lodge",
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
    slug: "demo-marine-drive-hotel",
    name: "Marine Drive Hotel",
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
    slug: "demo-nilgiri-hill-stay",
    name: "Nilgiri Hill Stay",
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
    slug: "demo-sundarbans-river-cruise",
    title: "Sundarbans River Cruise",
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
    slug: "demo-bandarban-hill-trek",
    title: "Bandarban Hill Trek",
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

/** Deletes every demo hotel/tour, their inventory, and any bookings made against them. */
async function removeDemo(): Promise<void> {
  const demoHotels = await db.hotel.findMany({
    where: { slug: { startsWith: "demo-" } },
    select: { id: true },
  });
  const demoTours = await db.tour.findMany({
    where: { slug: { startsWith: "demo-" } },
    select: { id: true },
  });
  const rooms = await db.hotelRoom.findMany({
    where: { hotelId: { in: demoHotels.map((h) => h.id) } },
    select: { id: true },
  });
  const schedules = await db.tourSchedule.findMany({
    where: { tourId: { in: demoTours.map((t) => t.id) } },
    select: { id: true },
  });
  const roomIds = rooms.map((r) => r.id);
  const scheduleIds = schedules.map((s) => s.id);
  const bookingIds = (
    await db.bookingItem.findMany({
      where: { OR: [{ hotelRoomId: { in: roomIds } }, { tourScheduleId: { in: scheduleIds } }] },
      select: { bookingId: true },
    })
  ).map((i) => i.bookingId);
  await db.$transaction(async (tx) => {
    const byBooking = { bookingId: { in: bookingIds } };
    await tx.inventoryHold.deleteMany({ where: byBooking });
    await tx.bookingItem.deleteMany({ where: byBooking });
    await tx.bookingGuest.deleteMany({ where: byBooking });
    await tx.bookingStatusHistory.deleteMany({ where: byBooking });
    await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await tx.roomInventory.deleteMany({ where: { roomId: { in: roomIds } } });
    await tx.roomRate.deleteMany({ where: { roomId: { in: roomIds } } });
    await tx.hotelRoom.deleteMany({ where: { id: { in: roomIds } } });
    await tx.hotel.deleteMany({ where: { id: { in: demoHotels.map((h) => h.id) } } });
    await tx.tourSchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    await tx.tour.deleteMany({ where: { id: { in: demoTours.map((t) => t.id) } } });
    // Destinations stay if anything real uses them; otherwise they go back to draft.
    await tx.destination.updateMany({
      where: {
        slug: { in: destinations.map((d) => d.slug) },
        hotels: { none: {} },
        tours: { none: {} },
      },
      data: { status: "DRAFT" },
    });
  });
  console.warn(
    `Removed demo data: ${demoHotels.length} hotels, ${demoTours.length} tours, ${bookingIds.length} bookings.`,
  );
}

void run(async () => {
  if (flag("remove")) return removeDemo();
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
        name: h.name + DEMO,
        destinationId: destIds.get(h.dest)!,
        starRating: h.stars,
        addressLine: "Demo listing — not a real property",
        summary:
          "A demo stay for trying Pegah before launch. Holds work; nothing is ever confirmed.",
        description:
          "This property is demo data. It shows how search, prices with service charge and VAT, and 15-minute holds work. It will be removed before launch.",
        cancellationPolicy: "Free cancellation until 3 days before check-in (demo policy).",
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
          description: `${r.name} (demo room)`,
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
        title: t.title + DEMO,
        summary:
          "A demo tour for trying Pegah before launch. Holds work; nothing is ever confirmed.",
        description:
          "This tour is demo data. It shows departures, seat counts and 15-minute holds. It will be removed before launch.",
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
        data: Array.from({ length: 16 }, (_, w) => {
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
    `Demo catalog ready: ${destinations.length} destinations, ${hotels.length} hotels, ${tours.length} tours.`,
  );
}, db);
