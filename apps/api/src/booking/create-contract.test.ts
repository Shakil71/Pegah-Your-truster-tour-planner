import { CreateBookingRequestSchema } from "@pegah/contracts";
import { describe, expect, it } from "vitest";

const base = {
  product: "TOUR",
  departureId: "01JBX0000000000000000000AA",
  adults: 2,
  children: 1,
  contact: { name: "Nusrat Jahan", email: " Nusrat@Example.com ", phone: "+8801711000000" },
  guests: [
    { fullName: "Nusrat Jahan", ageGroup: "ADULT" },
    { fullName: "Tanvir Ahmed", ageGroup: "ADULT" },
    { fullName: "Ayaan", ageGroup: "CHILD" },
  ],
  expectedTotal: { amountMinor: 2_730_000, currency: "BDT" },
};

describe("CreateBookingRequestSchema", () => {
  it("accepts a consistent party and normalises the email", () => {
    const parsed = CreateBookingRequestSchema.parse(base);
    expect(parsed.contact.email).toBe("nusrat@example.com");
  });

  it("rejects guest lists that do not match the party", () => {
    const r = CreateBookingRequestSchema.safeParse({ ...base, children: 0 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["guests"]);
  });

  it("requires an adult lead guest", () => {
    const guests = [base.guests[2], base.guests[0], base.guests[1]];
    const r = CreateBookingRequestSchema.safeParse({ ...base, guests });
    expect(r.success).toBe(false);
  });

  it("rejects floating-point money and past-the-checkout dates", () => {
    expect(
      CreateBookingRequestSchema.safeParse({
        ...base,
        expectedTotal: { amountMinor: 27300.5, currency: "BDT" },
      }).success,
    ).toBe(false);
    expect(
      CreateBookingRequestSchema.safeParse({
        product: "HOTEL",
        roomId: "01JBX0000000000000000000AA",
        checkIn: "2026-12-10",
        checkOut: "2026-12-10",
        rooms: 1,
        adults: 1,
        children: 0,
        contact: base.contact,
        guests: [base.guests[0]],
        expectedTotal: base.expectedTotal,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-Bangladeshi contact number", () => {
    const r = CreateBookingRequestSchema.safeParse({
      ...base,
      contact: { ...base.contact, phone: "01711000000" },
    });
    expect(r.success).toBe(false);
  });
});
