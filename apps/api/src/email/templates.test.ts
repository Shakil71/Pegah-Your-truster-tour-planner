import { describe, expect, it } from "vitest";
import { taka } from "./outbox-dispatcher.service";
import { templates, type BookingFacts } from "./templates";

const facts: BookingFacts = {
  reference: "PG-7K3QX9",
  productName: "Tea <Garden> & Resort",
  startDate: "2026-12-10",
  endDate: "2026-12-12",
  guests: 2,
  totalText: "৳ 21,505.50",
  contactName: 'Nusrat "N" Jahan',
  link: "https://pegah.example/account/bookings/X",
};

describe("email templates", () => {
  it("escapes every interpolated value in HTML", () => {
    const m = templates.bookingConfirmed(facts);
    expect(m.html).toContain("Tea &lt;Garden&gt; &amp; Resort");
    expect(m.html).toContain("Nusrat &quot;N&quot; Jahan");
    expect(m.html).not.toContain("<Garden>");
    expect(m.text).toContain("Tea <Garden> & Resort"); // plain text stays readable
  });

  it("only says confirmed when the booking is confirmed", () => {
    expect(templates.bookingHeld(facts, "10 Dec, 14:15").text).toMatch(
      /not confirmed until payment/,
    );
    expect(templates.bookingHeld(facts, "10 Dec, 14:15").subject).not.toMatch(/confirmed/i);
    expect(templates.bookingConfirmed(facts).subject).toBe("Booking confirmed · PG-7K3QX9");
  });

  it("states refunds honestly", () => {
    expect(templates.bookingCancelled(facts, "৳ 10,000").text).toContain(
      "refund of ৳ 10,000 has been approved",
    );
    expect(templates.bookingCancelled(facts, null).text).toContain("no refund is due");
  });
});

describe("taka formatting", () => {
  it("uses integer arithmetic and South Asian grouping", () => {
    expect(taka("2150550", "BDT")).toBe("৳ 21,505.50");
    expect(taka("1234567800", "BDT")).toBe("৳ 1,23,45,678");
    expect(taka("99", "BDT")).toBe("৳ 0.99");
    expect(taka("not-a-number", "BDT")).toBe("৳ 0");
  });
});
