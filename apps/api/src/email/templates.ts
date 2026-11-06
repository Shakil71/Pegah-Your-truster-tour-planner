/**
 * Transactional email templates: pure functions returning subject, plain
 * text and simple HTML, in English or Bangla (ADR-0036). Every interpolated
 * value is HTML-escaped. Wording is honest: nothing says "confirmed" unless
 * the booking is CONFIRMED.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface BookingFacts {
  reference: string;
  productName: string;
  startDate: string;
  endDate: string | null;
  guests: number;
  totalText: string;
  contactName: string;
  link: string | null;
}

/** Language of customer emails; staff alerts are always English. */
export type EmailLocale = "en" | "bn";
export const emailLocale = (v: string | null | undefined): EmailLocale =>
  v === "bn" ? "bn" : "en";

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const FOOTER: Record<EmailLocale, string> = {
  en: "You receive this because of a booking or account action on Pegah.",
  bn: "পেগাহ-তে একটি বুকিং বা অ্যাকাউন্ট কার্যক্রমের কারণে আপনি এই ইমেইলটি পেয়েছেন।",
};

/** Greeting line in each language. */
export const hello = (name: string, l: EmailLocale) =>
  l === "bn" ? `প্রিয় ${name},` : `Hello ${name},`;

export function layout(
  title: string,
  paragraphs: string[],
  cta?: { label: string; href: string },
  l: EmailLocale = "en",
): RenderedEmail["html"] {
  return `<!doctype html><html lang="${l}"><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,'Noto Sans Bengali','Hind Siliguri',sans-serif;color:#14172b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:22px;font-weight:bold;padding-bottom:8px">Pegah</td></tr>
<tr><td style="font-size:20px;padding-bottom:12px">${esc(title)}</td></tr>
${paragraphs.map((p) => `<tr><td style="font-size:15px;line-height:1.6;padding-bottom:10px">${p}</td></tr>`).join("")}
${cta ? `<tr><td style="padding-top:8px"><a href="${esc(cta.href)}" style="display:inline-block;background:#FF852F;color:#14172b;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#6b6f85;padding-top:18px">${FOOTER[l]}</td></tr>
</table></td></tr></table></body></html>`;
}

function tripLines(b: BookingFacts, l: EmailLocale): string[] {
  if (l === "bn") {
    return [
      `বুকিং রেফারেন্স: ${b.reference}`,
      b.productName,
      `তারিখ: ${b.startDate}${b.endDate ? ` থেকে ${b.endDate}` : ""} · ${b.guests} জন অতিথি`,
      `মোট: ${b.totalText}`,
    ];
  }
  return [
    `Booking reference: ${b.reference}`,
    b.productName,
    `Dates: ${b.startDate}${b.endDate ? ` to ${b.endDate}` : ""} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`,
    `Total: ${b.totalText}`,
  ];
}

interface Copy {
  title: string;
  intro: string;
  outro: string;
  cta: string;
}

function render(c: Copy, b: BookingFacts, l: EmailLocale): RenderedEmail {
  const lines = tripLines(b, l);
  const text = [
    hello(b.contactName, l),
    "",
    c.intro,
    "",
    ...lines,
    "",
    c.outro,
    ...(b.link ? ["", b.link] : []),
  ].join("\n");
  const html = layout(
    c.title,
    [esc(hello(b.contactName, l)), esc(c.intro), lines.map(esc).join("<br>"), esc(c.outro)],
    b.link ? { label: c.cta, href: b.link } : undefined,
    l,
  );
  return { subject: `${c.title} · ${b.reference}`, text, html };
}

const VIEW = { en: "View booking", bn: "বুকিং দেখুন" } as const;

export const templates = {
  bookingHeld: (b: BookingFacts, holdUntil: string, l: EmailLocale = "en") =>
    render(
      l === "bn"
        ? {
            title: "আপনার বুকিং হোল্ডে আছে",
            intro: `${holdUntil} (ঢাকা সময়) পর্যন্ত আমরা এটি আপনার জন্য রেখে দিচ্ছি। পেমেন্ট সম্পন্ন না হওয়া পর্যন্ত বুকিং কনফার্ম নয়।`,
            outro: "হোল্ড শেষ হওয়ার আগে পেমেন্ট না করলে এটি স্বয়ংক্রিয়ভাবে ছেড়ে দেওয়া হবে।",
            cta: VIEW.bn,
          }
        : {
            title: "Your booking is on hold",
            intro: `We are holding this for you until ${holdUntil} (Dhaka time). It is not confirmed until payment is completed.`,
            outro: "If you do not pay before the hold ends, it is released automatically.",
            cta: VIEW.en,
          },
      b,
      l,
    ),
  bookingConfirmed: (b: BookingFacts, l: EmailLocale = "en") =>
    render(
      l === "bn"
        ? {
            title: "বুকিং কনফার্ম হয়েছে",
            intro:
              "আপনার পেমেন্ট যাচাই হয়েছে এবং বুকিং কনফার্ম হয়েছে। আপনার ভাউচার অ্যাকাউন্টে প্রস্তুত।",
            outro: "চেক-ইনের সময় ভাউচারটি (ফোনে বা প্রিন্ট করে) দেখান।",
            cta: "ভাউচার খুলুন",
          }
        : {
            title: "Booking confirmed",
            intro:
              "Your payment was verified and your booking is confirmed. Your voucher is ready in your account.",
            outro: "Show the voucher (on your phone or printed) at check-in.",
            cta: "Open voucher",
          },
      b,
      l,
    ),
  cancellationRequested: (b: BookingFacts, l: EmailLocale = "en") =>
    render(
      l === "bn"
        ? {
            title: "বাতিলের অনুরোধ পেয়েছি",
            intro:
              "আপনার বাতিলের অনুরোধ আমরা পেয়েছি। আমাদের টিম বাতিল নীতিমালা অনুযায়ী এটি দেখে শিগগিরই জানাবে।",
            outro: "বাতিল নিশ্চিত না হওয়া পর্যন্ত আপনার বুকিং বহাল থাকবে।",
            cta: VIEW.bn,
          }
        : {
            title: "Cancellation request received",
            intro:
              "We received your request to cancel. Our team will review it against the cancellation policy and reply soon.",
            outro: "Your booking stays valid until we confirm the cancellation.",
            cta: VIEW.en,
          },
      b,
      l,
    ),
  /**
   * `giftCardText`: the part of the refund already credited back to the
   * customer's gift card (ADR-0037); the rest goes to the original payment.
   */
  bookingCancelled: (
    b: BookingFacts,
    refundText: string | null,
    l: EmailLocale = "en",
    giftCardText: string | null = null,
  ) =>
    render(
      l === "bn"
        ? {
            title: "বুকিং বাতিল হয়েছে",
            intro: !refundText
              ? "আপনার বুকিং বাতিল হয়েছে। বাতিল নীতিমালা অনুযায়ী কোনো রিফান্ড প্রযোজ্য নয়।"
              : giftCardText === refundText
                ? `আপনার বুকিং বাতিল হয়েছে। ${refundText} রিফান্ড অনুমোদিত হয়েছে এবং আপনার গিফট কার্ডে ফেরত জমা হয়েছে।`
                : giftCardText
                  ? `আপনার বুকিং বাতিল হয়েছে। ${refundText} রিফান্ড অনুমোদিত হয়েছে। এর মধ্যে ${giftCardText} আপনার গিফট কার্ডে ফেরত জমা হয়েছে; বাকিটা আপনার মূল পেমেন্ট মাধ্যমে ফেরত যাবে।`
                  : `আপনার বুকিং বাতিল হয়েছে। ${refundText} রিফান্ড অনুমোদিত হয়েছে, যা আপনার মূল পেমেন্ট মাধ্যমে ফেরত যাবে।`,
            outro: "আরেকটি ভ্রমণে আপনাকে স্বাগত জানানোর অপেক্ষায় রইলাম।",
            cta: VIEW.bn,
          }
        : {
            title: "Booking cancelled",
            intro: !refundText
              ? "Your booking is cancelled. Under the cancellation policy no refund is due."
              : giftCardText === refundText
                ? `Your booking is cancelled. A refund of ${refundText} has been approved and added back to your gift card.`
                : giftCardText
                  ? `Your booking is cancelled. A refund of ${refundText} has been approved. ${giftCardText} of it has been added back to your gift card; the rest will be returned to your original payment method.`
                  : `Your booking is cancelled. A refund of ${refundText} has been approved and will be returned to your original payment method.`,
            outro: "We hope to welcome you on another trip.",
            cta: VIEW.en,
          },
      b,
      l,
    ),
  cancellationRejected: (b: BookingFacts, reason: string, l: EmailLocale = "en") =>
    render(
      l === "bn"
        ? {
            title: "আপনার বাতিলের অনুরোধ সম্পর্কে",
            intro: `এই বুকিংটি বাতিল করা যায়নি: ${reason}`,
            outro: "আপনার বুকিং কনফার্মই থাকছে। কোনো প্রশ্ন থাকলে এই ইমেইলের উত্তর দিন।",
            cta: VIEW.bn,
          }
        : {
            title: "About your cancellation request",
            intro: `We could not cancel this booking: ${reason}`,
            outro: "Your booking remains confirmed. Reply to this email if you have questions.",
            cta: VIEW.en,
          },
      b,
      l,
    ),
  refundPaid: (b: BookingFacts, refundText: string, l: EmailLocale = "en") =>
    render(
      l === "bn"
        ? {
            title: "রিফান্ড পাঠানো হয়েছে",
            intro: `আমরা ${refundText} ফেরত পাঠিয়েছি। আপনার ব্যাংক বা ওয়ালেটে দেখা যেতে কয়েক দিন লাগতে পারে।`,
            outro: "পেগাহর সাথে ভ্রমণের জন্য ধন্যবাদ।",
            cta: VIEW.bn,
          }
        : {
            title: "Refund sent",
            intro: `We have returned ${refundText}. Depending on your bank or wallet it can take a few days to appear.`,
            outro: "Thank you for travelling with Pegah.",
            cta: VIEW.en,
          },
      b,
      l,
    ),
  emailVerification: (name: string, link: string, l: EmailLocale = "en"): RenderedEmail => {
    const c =
      l === "bn"
        ? {
            subject: "পেগাহ-এর জন্য আপনার ইমেইল নিশ্চিত করুন",
            title: "আপনার ইমেইল নিশ্চিত করুন",
            body: "পেগাহ-তে স্বাগতম। এই ইমেইল ঠিকানাটি আপনার, তা নিশ্চিত করুন। লিংকটি ৪৮ ঘণ্টা কাজ করবে।",
            ignore: "আপনি অ্যাকাউন্ট না খুলে থাকলে এই ইমেইলটি উপেক্ষা করুন।",
            cta: "আমার ইমেইল নিশ্চিত করুন",
          }
        : {
            subject: "Confirm your email for Pegah",
            title: "Confirm your email",
            body: "Welcome to Pegah. Please confirm this is your email address. The link works for 48 hours.",
            ignore: "If you did not create an account, ignore this email.",
            cta: "Confirm my email",
          };
    return {
      subject: c.subject,
      text: `${hello(name, l)}\n\n${c.body}\n${link}\n\n${c.ignore}`,
      html: layout(
        c.title,
        [esc(hello(name, l)), c.body, c.ignore],
        { label: c.cta, href: link },
        l,
      ),
    };
  },
  passwordReset: (name: string, link: string, l: EmailLocale = "en"): RenderedEmail => {
    const c =
      l === "bn"
        ? {
            subject: "আপনার পেগাহ পাসওয়ার্ড রিসেট করুন",
            title: "পাসওয়ার্ড রিসেট",
            body: "নতুন পাসওয়ার্ড বেছে নিতে ৩০ মিনিটের মধ্যে লিংকটি ব্যবহার করুন।",
            ignore: "আপনি এটি না চেয়ে থাকলে ইমেইলটি উপেক্ষা করুন; আপনার পাসওয়ার্ড একই থাকবে।",
            cta: "নতুন পাসওয়ার্ড দিন",
          }
        : {
            subject: "Reset your Pegah password",
            title: "Reset your password",
            body: "Use the link within 30 minutes to choose a new password.",
            ignore: "If you did not ask for this, ignore this email; your password stays the same.",
            cta: "Choose a new password",
          };
    return {
      subject: c.subject,
      text: `${hello(name, l)}\n\n${c.body}\n${link}\n\n${c.ignore}`,
      html: layout(
        c.title,
        [esc(hello(name, l)), c.body, c.ignore],
        { label: c.cta, href: link },
        l,
      ),
    };
  },
};
