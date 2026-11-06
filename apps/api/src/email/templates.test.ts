import { describe, expect, it } from "vitest";
import { taka } from "./outbox-dispatcher.service";
import { emailLocale, templates, type BookingFacts } from "./templates";

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
    expect(templates.bookingCancelled(facts, "৳ 10,000", "en", "৳ 10,000").text).toContain(
      "added back to your gift card",
    );
    expect(templates.bookingCancelled(facts, "৳ 10,000", "en", "৳ 4,000").text).toContain(
      "৳ 4,000 of it has been added back to your gift card; the rest",
    );
    expect(templates.bookingCancelled(facts, "৳ 10,000", "bn", "৳ 4,000").text).toContain(
      "গিফট কার্ডে ফেরত জমা হয়েছে",
    );
  });
});

describe("Bangla emails (ADR-0036)", () => {
  const all = (l: "en" | "bn") => [
    templates.bookingHeld(facts, "১০ ডিসেম্বর, ১৪:১৫", l),
    templates.bookingConfirmed(facts, l),
    templates.cancellationRequested(facts, l),
    templates.bookingCancelled(facts, "৳ 10,000", l),
    templates.bookingCancelled(facts, null, l),
    templates.cancellationRejected(facts, "Too late", l),
    templates.refundPaid(facts, "৳ 10,000", l),
    templates.emailVerification("Nusrat", "https://pegah.example/verify-email?token=x", l),
    templates.passwordReset("Nusrat", "https://pegah.example/reset-password?token=x", l),
  ];

  it("writes every customer email in Bangla when asked, with the right language tag", () => {
    for (const m of all("bn")) {
      expect(m.html).toContain('<html lang="bn">');
      expect(m.subject).toMatch(/[ঀ-৿]/);
      expect(m.text).toMatch(/[ঀ-৿]/);
      // No English sentence leaks into the Bangla version.
      expect(m.text).not.toMatch(/\b(Hello|Booking reference|Your booking|We )\b/);
    }
    for (const m of all("en")) {
      expect(m.html).toContain('<html lang="en">');
      expect(m.subject).not.toMatch(/[ঀ-৿]/);
    }
  });

  it("keeps the same honesty rules and escaping in Bangla", () => {
    const held = templates.bookingHeld(facts, "শিগগিরই", "bn");
    expect(held.text).toContain("কনফার্ম নয়");
    expect(held.subject).not.toContain("কনফার্ম হয়েছে");
    expect(templates.bookingConfirmed(facts, "bn").subject).toBe(
      "বুকিং কনফার্ম হয়েছে · PG-7K3QX9",
    );
    expect(templates.bookingConfirmed(facts, "bn").html).toContain(
      "Tea &lt;Garden&gt; &amp; Resort",
    );
    expect(templates.bookingCancelled(facts, null, "bn").text).toContain(
      "কোনো রিফান্ড প্রযোজ্য নয়",
    );
  });

  it("falls back to English for anything but bn", () => {
    expect(emailLocale("bn")).toBe("bn");
    expect(emailLocale("en")).toBe("en");
    expect(emailLocale(null)).toBe("en");
    expect(emailLocale("fr")).toBe("en");
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
