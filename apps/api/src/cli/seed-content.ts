/**
 * Creates starter DRAFTS for the content pages linked from the website footer,
 * only where a page does not exist yet. Never publishes and never overwrites:
 * an owner must review (especially Terms and Privacy) and publish in the admin.
 *
 *   node apps/api/dist/cli/seed-content.js     (run by deploy.sh; idempotent)
 */
import { cliDb, run } from "./cli-db";

const db = cliDb();

const DRAFT_NOTE = "DRAFT — review and edit before publishing.";

const pages: { slug: string; title: string; summary: string; body: string }[] = [
  {
    slug: "about",
    title: "About Pegah",
    summary: "A Bangladeshi travel company for stays and guided tours across the country.",
    body: `${DRAFT_NOTE}\n\nPegah helps travellers book hotels and guided tours across Bangladesh, priced in taka.\n\n## How booking works\n\nYou can hold a room or tour seats for 15 minutes while you pay. A booking is confirmed only after the payment is verified, and you receive a voucher in your account.`,
  },
  {
    slug: "terms",
    title: "Terms of service",
    summary: "The terms that apply when you book with Pegah.",
    body: `${DRAFT_NOTE} These terms must be written or reviewed by the owner (and a lawyer) before publishing.\n\n## Bookings\n\nA booking is confirmed only after payment is verified.\n\n## Cancellations\n\nEach stay or tour shows its cancellation policy before you book.`,
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary: "What personal data Pegah collects and how it is used.",
    body: `${DRAFT_NOTE} This policy must be written or reviewed by the owner (and a lawyer) before publishing.\n\n## What we collect\n\nYour name, email, mobile number, traveller names and booking details, to provide your booking.\n\n## Payments\n\nCard and wallet details are entered on the payment provider's page; Pegah never stores them.`,
  },
  {
    slug: "cancellations",
    title: "Cancellations and refunds",
    summary: "How to cancel a booking and how refunds are handled.",
    body: `${DRAFT_NOTE}\n\nUnpaid holds can be cancelled at any time from My trips.\n\nFor a confirmed booking, request cancellation from the booking page. Our team reviews it against the cancellation policy shown when you booked and emails you the decision. Approved refunds go back to the original payment method.`,
  },
  {
    slug: "payments",
    title: "Payment methods",
    summary: "How you can pay for a booking.",
    body: `${DRAFT_NOTE}\n\nOnline payment by card and mobile wallet will be available through our payment partner. Prices are in Bangladeshi taka and include service charge and VAT where they apply.`,
  },
  {
    slug: "contact",
    title: "Contact a planner",
    summary: "How to reach the Pegah team.",
    body: `${DRAFT_NOTE} Add the real phone number, email and office hours before publishing.`,
  },
  {
    slug: "partners",
    title: "For hotels and tour operators",
    summary: "Sell your rooms and tours on Pegah.",
    body: `${DRAFT_NOTE}\n\nHotels and tour operators can list their inventory on Pegah. Contact us to get started.`,
  },
];

void run(async () => {
  let created = 0;
  for (const p of pages) {
    const exists = await db.contentPage.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    if (exists) continue;
    await db.contentPage.create({ data: { ...p, status: "DRAFT" } });
    created++;
  }
  console.warn(`Content drafts: ${created} created, ${pages.length - created} already existed.`);
}, db);
