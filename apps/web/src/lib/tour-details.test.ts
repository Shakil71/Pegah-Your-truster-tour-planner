import { describe, expect, it } from "vitest";
import {
  describe as describeText,
  groups,
  itinerary,
  labelled,
  pickups,
  points,
  startTime,
} from "./tour-details";

describe("itinerary", () => {
  it("reads numbered days with numbered steps", () => {
    const it1 = itinerary(
      "Day One:\n\n1. Dhaka to Cox's Bazar as per bus ticket schedule\n\n2. Hotel Chek-in at before 2 pm,\n\nDay Two:\n\n1. Free day.",
    );
    expect(it1.days).toEqual([
      {
        day: 1,
        title: null,
        steps: [
          { time: null, text: "Dhaka to Cox's Bazar as per bus ticket schedule" },
          { time: null, text: "Hotel Chek-in at before 2 pm" },
        ],
      },
      { day: 2, title: null, steps: [{ time: null, text: "Free day." }] },
    ]);
  });

  it("reads titles, clock times and the partners written before day one", () => {
    const it2 = itinerary(
      [
        "Our Transport Partners:",
        "Robi Xpress - Desh Travels",
        "## Day 1: Sailing to St. Martin Island",
        "7 AM: The trip will start from Teknaf Jetty.",
        "8 AM(Approx): Journey to Sajek Valley by CNG.",
        "10 PM Dinner at Highway side Restaurant",
        "Spend the rest of the day on the beach.",
      ].join("\n"),
    );
    expect(it2.intro).toEqual([
      { label: "Our Transport Partners", value: "Robi Xpress - Desh Travels" },
    ]);
    expect(it2.days[0]).toEqual({
      day: 1,
      title: "Sailing to St. Martin Island",
      steps: [
        { time: "7 AM", text: "The trip will start from Teknaf Jetty." },
        { time: "8 AM", text: "Journey to Sajek Valley by CNG." },
        { time: "10 PM", text: "Dinner at Highway side Restaurant" },
        { time: null, text: "Spend the rest of the day on the beach." },
      ],
    });
  });

  it("treats a long text after 'Day 2:' as a step, and keeps a leading title", () => {
    const long =
      "After spending the night in Tanguar, the boat will take you to Niladri in the morning.";
    const it3 = itinerary(`## Valley Of Clouds\nDay 1:\nStart.\nDay 2: ${long}`);
    expect(it3.title).toBe("Valley Of Clouds");
    expect(it3.days[1]).toEqual({ day: 2, title: null, steps: [{ time: null, text: long }] });
  });

  it("returns no days for text without day headings", () => {
    expect(itinerary("We leave in the evening and return the next night.").days).toEqual([]);
  });
});

describe("groups", () => {
  it("groups points under headings with or without a colon", () => {
    expect(
      groups(
        "Cancellation\n\n• 50% refunded 72 hours before.\n• No refund within 48 hours.\n\nRefund:\n\n• Fee is non-refundable.",
      ),
    ).toEqual([
      {
        title: "Cancellation",
        points: ["50% refunded 72 hours before.", "No refund within 48 hours."],
        text: [],
      },
      { title: "Refund", points: ["Fee is non-refundable."], text: [] },
    ]);
  });

  it("drops a heading that repeats the section name and keeps loose text", () => {
    expect(groups("Travel Tips:\n\n• Water\n• Hat\n\nDo not litter.", /travel tips/i)).toEqual([
      { title: null, points: ["Water", "Hat"], text: ["Do not litter."] },
    ]);
  });

  it("reads each line under a heading as one rule", () => {
    expect(groups("Child Policy:\n\n0–3 years fully free.\n5-10 years 70% payable.")).toEqual([
      {
        title: "Child Policy",
        points: ["0–3 years fully free.", "5-10 years 70% payable."],
        text: [],
      },
    ]);
  });
});

describe("description", () => {
  it("turns label lines into rows, including a value on the next line", () => {
    expect(
      describeText(
        "Package Duration: 3 Days and 2 night\n\nNote: - Book 7 days ahead.\n\nConfirm deadline:\n\nUp to 7 days before the tour.\n\nA lovely trip. Truly: lovely.",
      ),
    ).toEqual([
      { type: "row", label: "Package Duration", value: "3 Days and 2 night" },
      { type: "row", label: "Note", value: "Book 7 days ahead." },
      { type: "row", label: "Confirm deadline", value: "Up to 7 days before the tour." },
      { type: "para", text: "A lovely trip. Truly: lovely." },
    ]);
  });

  it("keeps lists and their headings together", () => {
    expect(
      describeText(
        "Intro.\n\n• 2 Days\n• Eco resort\n\nFood Menu:\n\nDay 1\n\n• Breakfast: Paratha",
      ),
    ).toEqual([
      { type: "para", text: "Intro." },
      { type: "points", items: ["2 Days", "Eco resort"] },
      { type: "heading", text: "Food Menu" },
      { type: "heading", text: "Day 1" },
      { type: "points", items: ["Breakfast: Paratha"] },
    ]);
    expect(labelled("Breakfast: Paratha, Egg")).toEqual({
      label: "Breakfast",
      value: "Paratha, Egg",
    });
    expect(labelled("It is 9:30 in the morning, say hi")).toBeNull();
  });
});

describe("small helpers", () => {
  it("de-duplicates transport and pick-up places", () => {
    expect(points("• AC BUS\n• Cruise Ship\n• AC Bus (32 seats)")).toEqual([
      "Cruise Ship",
      "AC Bus (32 seats)",
    ]);
    expect(
      pickups(["Kalabagan", "Arambag", "kalabagan", "The trip will start from Kalabagan at 8 pm."]),
    ).toEqual({
      places: ["Kalabagan", "Arambag"],
      notes: ["The trip will start from Kalabagan at 8 pm."],
    });
  });

  it("shows the timing only when it is a clock time", () => {
    expect(startTime("Stating time at 9:30 pm at Kolabagan")).toBe(
      "Starting time at 9:30 pm at Kolabagan",
    );
    expect(startTime("12:00 PM")).toBe("12:00 PM");
    expect(startTime("3 Days 2 Night")).toBeNull();
    expect(startTime(null)).toBeNull();
  });
});
