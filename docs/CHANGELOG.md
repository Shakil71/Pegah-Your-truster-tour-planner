# Changelog

All notable changes to this project. Format based on Keep a Changelog.

## [Unreleased]

### Changed — Tour pages (2026-11-16)

- Tour page redesigned: photo banner (large photo + side photos, all open
  the viewer), "at a glance" tiles (duration, type, group size, meeting
  point, start time, transport), in-page section bar, and titled sections:
  overview with a key-facts sheet, a day-by-day timeline with clock times,
  included / not included side by side, getting there (pick-up points,
  transport, facilities), policies as collapsible groups with a
  cancellation summary, and good to know. "More tours in …" at the end.
- Free text from the console or the old website is laid out by
  `lib/tour-details.ts` (unit-tested); nothing is invented.
- Tours with no departure on sale show a "Request this tour" card: guide
  price, WhatsApp, call, and a link to `/contact` that pre-fills the message.
  A price bar with the booking button stays at the bottom on phones.
- Guide price: Console → Tours → "Guide price" / "Offer price" (BDT; offer
  must be lower). Public tour summaries gain `guidePrice`, `guideWasPrice`
  and `tourType` (additive; OpenAPI and client regenerated). Departures still
  set the price charged.
- Tour cards (tours list, home, related tours) show the guide price and type.
- Legacy import: the old "Inclusion" field's "Exclusion" list now goes to
  `excludes`; re-running the import fixes tours imported earlier, only where
  staff have not edited the lists.
- Fix: the photo viewer's "Photo n of total" label failed to format on hotel,
  room and tour pages.

### Added — Contact form and menu settings (2026-11-16)

- `/contact` (in the main menu and the footer): anyone can ask about a new
  booking, a reservation, a package or anything else; optional travel date
  and guests; the sender gets a reference (PC-…) and an acknowledgement
  email, staff get an alert. Rate-limited, honeypot against bots; nothing is
  held or confirmed by sending a message.
- Console → Services → Contact messages: filter by status, search, call or
  email, staff notes, New → In progress → Closed (audited).
- Console → Settings → Website menu: Stays, Flights and Visa are off in the
  public menu by default and can be turned on; My account shows a "Plan a
  trip" row with every service.
- Home search panel: the Visa tab is removed and the tabs are centred.

### Added — Seasonal gift cards (2026-11-16)

- `/gift-cards` shows four sea-season cards — Cox's Bazar Sunset Weekend
  (৳3,000), Saint Martin Island Escape (৳5,000), Cox's Bazar Family Holiday
  (৳10,000) and Saint Martin Coral Getaway (৳15,000) — with licensed photos
  and credits, in English and Bangla.
- Choosing a card fills the order form's amount and gift message (both can
  be changed); visitors who are not signed in come back to the chosen card
  after signing in. Each is an ordinary Pegah gift card usable on any stay
  or tour, and the page says so; no new data is stored.

### Changed — Offer pages (2026-11-16)

- Offer pages lay the package out in titled cards — what's included, hotels
  (one tile per city), what you need, payment and cancellation, offices
  (phone and email as links) — read from the offer text ("~" points,
  "Label: value" rows, "## Heading" and "Heading~" titles).
- A "package at a glance" row shows duration, nights per city and whether
  visa, air tickets, meals, transport and insurance are included; each
  fact appears only when the offer text says so.
- The price card stays in view while scrolling, explains the three steps
  after ordering, and a "Questions?" card offers WhatsApp and a call.
- Offer photos now carry their size (`width`/`height`, optional, on the
  shared media reference), so small photos are shown sharp like on hotel
  pages; summaries clipped on import end at the last full sentence.

### Changed — Hotel room cards (2026-11-16)

- Room cards on hotel pages are redesigned: a fixed 4:3 photo with a photo
  count that never stretches with long text, key facts, the room description
  as one point per line (six shown, the rest behind "Show more room
  details"; "•", "\*\*" and "in room – a, b, c" lists are split, list intros
  and points cut short by the import are dropped), up to six facilities, and
  the price with the booking button in a footer row.
- When a room is not on sale for the chosen dates, the card offers "Ask on
  WhatsApp" (message prefilled with hotel, room, dates and guests) and "Call
  us" instead of a dead end. Asking holds or confirms nothing.
- Each room shows its other photos as thumbnails under the main photo
  ("+N" when there are more); any photo opens a full-screen viewer with
  previous/next buttons, arrow keys and a thumbnail strip. The hotel
  gallery uses the same viewer.
- Room cards read the room's full details (kept on import in `details`),
  not the 480-character description, so no point is cut off; "## Heading"
  lines become small section titles above their points.
- Text imported from the old website no longer shows HTML entities
  ("Caf&eacute;" → "Café") anywhere on the hotel page or hotel list.

### Added — Hotels page, phone menu and sharper old photos (2026-11-16)

- `/hotels` lists every published hotel by destination, with a destination
  filter, no dates needed; each card opens the hotel page to choose dates and
  book. "Hotels" is the first item in the main menu (English and Bangla).
- Phones and tablets get a menu button; the full menu shows from 1024 px.
- Photos from the old website are mostly 300–480 px. Hotel and tour banners
  now show such a photo sharp, near its real size, over a blurred backdrop
  instead of stretching it to 1280 px; the full-screen gallery does the same.
  Media library images are no longer re-encoded by the Next.js optimiser.

### Fixed — Public domain sign-in and HTTPS config (2026-11-16)

- `enable-https.sh` no longer replaces `APP_ORIGINS`: it adds the IP origins
  and keeps the rest, so re-running it cannot break sign-in on
  `https://pegah.com.bd` with "Origin not allowed".
- The public-domain nginx config (`infra/nginx/pegah-public.conf`) and the
  certbot deploy hook are now in the repository; the config gains the 6 MB
  limit on document upload routes and an HSTS header.
- `.gitignore` keeps old-website import inputs (`/images/`, `/legacy-*/`)
  out of the repository.

### Operations — Old website data live (2026-11-16)

- Old website imported on the production server and its hotels, tours,
  destinations, packages and pages published; demo catalog unpublished
  (docs/operations/LEGACY_IMPORT.md#production-run-2026-11-16).

### Added — cPanel shared hosting support (2026-11-06)

- Upload bundle built by GitHub Actions (cPanel bundle workflow), standalone
  Next.js servers, one-shot background job runner for cron, MariaDB 11.4 CI
  job and a step-by-step runbook (ADR-0040, docs/operations/CPANEL_DEPLOYMENT.md).

### Added — Visa services and flight requests (2026-11-06)

- `/visa`: visas Pegah handles, with processing time, starting price and
  the documents needed; customers apply online. `/flights`: request a price
  for domestic or international tickets. The home page Flights and Visa tabs
  are live.
- My account → Visa & flights: status timeline, price, messages with the
  team, secure document upload (encrypted, deleted 90 days after closing)
  and cancellation before payment.
- Console → Services: request queue with filters and search, one-step
  actions (ask customer, send price, record payment, start, complete,
  reject, cancel, notes incl. internal), staff document upload; visa
  catalogue editor. Customer and staff emails for every step (ADR-0039).

### Added — Photo galleries, facilities and full details (2026-11-06)

- Hotel pages show a photo gallery with a full-screen viewer, facilities by
  group, distances, nearby places and house policies; room cards show a photo,
  facilities, air conditioning and extra beds. Tour pages show the gallery,
  day-by-day itinerary, pick-up points, transport, facilities, policies and
  travel tips (English and Bangla labels).
- Console: hotel, room and tour forms edit these fields, the gallery (add
  several photos, reorder, remove) and facilities (pick or add new). Old
  website prices are shown as reference only.
- Room limits widened to 30 adults / 20 children and list items to 300
  characters so imported records can be saved.

### Added — Old website import (2026-11-06)

- Importer for the previous Pegah website: 45 hotels with 169 rooms, 16 tours,
  8 packages, destinations, amenities, photo galleries, customers, coupons and
  pages, all as drafts for review; every original row kept verbatim and
  browsable in Console → Old website data (ADR-0038,
  `docs/operations/LEGACY_IMPORT.md`).
- New catalog fields: hotel contact, map, distances, policies and nearby
  places; room details, beds, size, extra beds and reference prices; tour
  overview, itinerary, policies, tips, pickup points, transport and tags;
  galleries and amenities for hotels, rooms and tours.
- Customers from the old site can sign in with their old password once; it is
  then upgraded to Argon2id.

### Added — Refunds back to gift cards (2026-11-06)

- When a confirmed booking paid with a gift card is cancelled with a refund,
  the gift card share is credited back to the card at once; only the rest
  waits for finance. Fully card-paid bookings close as REFUNDED immediately
  (ADR-0037). Console, customer booking page and cancellation email show it.

### Changed — Home hero (2026-11-06)

- Removed the "Stays · Tours · Planning across Bangladesh" line above the
  home page headline, as requested by the owner.

### Added — Bangla partner portal (2026-11-06)

- The supplier and agent portal (sign-in, overview, room calendar and rate
  editor, departures, reservations, client bookings, statement, account) is
  available in Bangla with a language switch in the header; dates and weekday
  names follow the language. The translation guard now covers the portal.

### Added — Bangla emails (2026-11-06)

- Customer emails (bookings, refunds, verification, password reset, orders,
  gift cards) are sent in Bangla for customers who use the site in Bangla;
  Profile → "Language for emails" changes it (ADR-0036).

### Added — Email verification (2026-11-06)

- New customer accounts get a confirmation link by email; account pages show
  a reminder with "Send the link again" (English and Bangla) (ADR-0035).
- Console setting to require a confirmed email before holds and orders (off by
  default; only active while SMTP works). Customer list shows who confirmed.

### Added — Gift cards at checkout (2026-11-06)

- Customers apply a gift card on a held booking; the balance pays part or all
  of it. Fully covered bookings are confirmed at once; otherwise Pay now asks
  only for the rest (ADR-0034).
- Money returns to the card if the booking expires or is cancelled before
  confirmation, or when the customer removes the card.
- Console gift card history shows the booking each redemption belongs to.

### Added — Offers, ads, orders, gift cards and dark mode (2026-11-06)

- Website **Offers** (list and detail, order with quantity) and **Gift cards**
  (preset or custom amount, for yourself or someone else, balance check), and
  **My account → Orders** with Pay now (ADR-0032).
- Console **Offers**, **Ads** (scheduled photo banners on the home and Offers
  pages), **Orders** (filters, Mark as paid with reference, Cancel) and
  **Gift cards** (search, history, issue without payment, resend, void).
- Every order and payment is emailed to the purchase-alert address
  (default pegah.com.bd@gmail.com) once SMTP is configured.
- Light/dark theme toggle on the website, partner portal and console,
  remembered per visitor (ADR-0033).

### Fixed

- Console tables that scroll sideways are keyboard-focusable.

### Added — Brand and About page (2026-11-05)

- Owner-supplied Pegah logo across website, console and partner portal, with a
  light version for dark surfaces.
- About page (English and Bangla): journey since 2022, corporate, family and
  honeymoon tours, gift cards, honesty and sincerity, contact details.
- Company contact details as Settings defaults; new "Email for purchase
  alerts" setting (default pegah.com.bd@gmail.com).

### Added — Home page editor (2026-11-05)

- Console **Content → Home page**: hero slides from the media library with
  bilingual captions, featured destinations, hotels and tours from the real
  catalog (ordered), and bilingual promises (ADR-0031).
- The website home page renders these from `GET /home`; empty sections keep
  the built-in content.

### Added — Media library (2026-11-05)

- Console **Media library**: upload (resized in the browser, re-encoded as
  WebP without camera/GPS data), captions and credits, delete when unused
  (ADR-0030).
- Main photo picker for destinations, hotels and tours; the website shows the
  chosen photo.
- Migration `20261110090000_media_blobs`.

### Added — Console control (2026-11-05)

- Settings page is now editable: contact details, announcement banner
  (English and Bangla), hold and payment-extension minutes, SSLCOMMERZ and SMTP
  with encrypted, write-only passwords and a test-email button (ADR-0029).
- Customer account controls: disable/enable with a reason, sign out everywhere.
- Website shows the banner and contact details from the console.
- Migration `20261109090000_site_settings`; permissions `customer:manage`,
  `settings:manage`, `settings:secrets`.

### Added — Bangla website (2026-11-05)

- EN / বাংলা switch in the header; the whole customer website (home, search,
  stays, tours, checkout, sign-in, account, trips, voucher, content pages) in
  Bangla with next-intl; URLs unchanged (ADR-0028).
- Bangla catalog names where filled in; Bangla form validation messages;
  Hind Siliguri for Bangla text.
- Translation guard test and a Bangla end-to-end + axe test.

### Added — Worker, Redis rate limits, monitoring (2026-11-05)

- `pegah-worker` process (same codebase, `dist/worker.js`) for hold expiry,
  payment reconciliation and the email outbox; `RUN_BACKGROUND_JOBS` switch.
- Shared rate limits in Redis (`REDIS_URL`) with a per-process fallback.
- Prometheus metrics on loopback ports; Prometheus, node_exporter and Grafana
  setup script with a Pegah dashboard and alert rules (ADR-0027).
- Root scripts `infra/server/enable-worker-redis.sh` and
  `infra/server/enable-monitoring.sh`; deploys restart the worker once installed.

### Added — Console Settings page (2026-11-05)

- `GET /admin/settings` (`settings:read`, owner and admin) and a read-only
  Settings page: payment and email status (no secret values), queued and failed
  emails, hold and session limits, build and database status.
- Removed the last "coming soon" placeholder and stale sidebar copy.

### Added — End-to-end and accessibility testing (2026-11-05)

- Playwright suite in `e2e/` against the real stack and MySQL, with axe WCAG
  2.1 AA scans and phone-width checks; new CI job, required for deploys.
- Accessibility fixes: contrast (`--pg-thread-ink`, darker `--pg-ink-3`),
  fixed colour tokens instead of raw hex, console account chip name,
  keyboard-scrollable report tables.
- Plain-English validation messages for all forms and API errors.

### Added — Phase 7: partner portals (2026-11-04)

- Partners (suppliers and travel agents) with their own sign-in at `/partner`
  and a separate session cookie; customer and staff sign-in refuse partner
  accounts (ADR-0026).
- Supplier portal: overview of assigned hotels and tours, room calendar (rooms
  on sale and rates), departure seats and close/reopen, reservations.
- Agent portal: Book for a client on stay and tour pages, agent checkout,
  booking page with Pay, client bookings with commission, monthly statement.
- Admin Suppliers and agents page (`partner:manage`): create partners and
  users, commission, suspend (revokes sessions), assign hotels and tours.
  Booking detail shows the agent and commission.
- Payment return sends agents to the partner portal; client emails for agent
  bookings carry no account link.
- Money input helpers moved to `@pegah/shared` (shared by web and admin).
- Migration `20261108090000_partners` (partners, ownership columns, commission CHECKs).
- Tests: partner MySQL integration suite; partner e2e smoke.

### Added — Staff password change (2026-11-04)

- `POST /staff/auth/password` and an admin **My account** page (click your name
  in the header). Changing the password signs out your other devices.

### Added — Phase 6 completion: promotions, reports, content (2026-11-04)

- Promotions: admin CRUD, codes at checkout (server re-pricing), discount on the
  base with taxes recomputed, limits under row lock, redemptions returned on
  expiry (ADR-0025). Discount shown on checkout, trip page, voucher and admin.
- Sales report with CSV export (safe against spreadsheet formula injection).
- Content pages with an admin editor, public `/pages/{slug}`, real footer
  links, starter drafts created on deploy (never auto-published).
- Permissions `promotion:manage`, `report:read`, `content:manage`.
- Migration `20261107090000_promotions_content` (widened bookings CHECK).
- Tests: growth MySQL integration suite, discount pricing unit tests.

### Added — Phase 5 completion (2026-11-04)

- Cancellation request → staff decision (refund capped at the amount paid,
  sold inventory released) → finance marks refund paid → REFUNDED (ADR-0024).
- Outbox dispatcher and email service (none / log / SMTP with TLS), templates
  for hold, confirmation, cancellation, rejection and refund; email log per booking.
- Password change (signs out other devices) and password reset (single-use,
  30-minute, hashed token, no account probing).
- Profile editing and saved travellers (suggested at checkout).
- Voucher and tax invoice page for confirmed bookings; trip page shows
  voucher, cancellation request and refunds.
- Admin: cancellation decision form, refunds and emails on bookings, Refunds page.
- Migration `20261106090000_phase5_completion` (refunds, traveller_profiles,
  password_reset_tokens, email_messages).
- Tests: 7 MySQL integration tests, template tests; 54-step smoke run.

### Added — Phase 6 operations admin, modules connected (2026-11-04)

- API (`/api/v1/admin`): destinations, hotels, room types, room calendar
  (GET + bulk PUT with weekday rules), tours, departures (create, capacity,
  prices, close/reopen/cancel), customers list and detail (ADR-0023).
- Safety: inventory never below rooms held or sold; departure capacity never
  below seats taken; departures with bookings cannot be cancelled; past dates
  locked; every change audited.
- Connections: booking detail gains `customer` and `product`; booking list
  filters `customerId`, `hotel`, `tour`; hotel/tour lists show active bookings.
- Admin: Catalog section (destinations, hotels and rooms, room calendar with
  bulk editor, tours and departures), Customers, related-links bar on bookings,
  removable scope chips, dashboard links to hotels and tours.
- Web: trip page links back to the property or tour.
- Tests: 5 MySQL integration suites for Phase 6; guard against duplicate DTO
  class names; 42-step end-to-end smoke run.
- `docs/ROADMAP.md`: one checklist for every phase and item.

### Fixed

- Admin and public DTO classes shared names (HotelDetailDto, TourDetailDto),
  so one OpenAPI schema overwrote the other; admin DTOs are now prefixed.

### Added — Payment module, SSLCOMMERZ ready but switched off (2026-11-04)

- `payments` and `payment_events` tables (additive migration
  `20261105090000_payments`, CHECK amount > 0).
- `PaymentProvider` port with an SSLCOMMERZ v4 adapter (session, validation,
  lookup by `tran_id`, callback signature) and a development-only simulator.
  `PAYMENT_PROVIDER=none` by default; live mode needs explicit approval (ADR-0022).
- API: `POST /me/bookings/{id}/payment-session`, SSLCOMMERZ IPN and return
  endpoints, `GET /admin/payments`; booking detail gains `payments` and `canPay`.
- Verified payments confirm bookings through the state machine and turn held
  inventory into sold; mismatches go to manual review; late payments are
  flagged `REFUND_REQUIRED`; the hold sweeper reconciles before expiring.
- Web: working "Pay now" when payments are enabled, payment result banner,
  payment history. Admin: Payments page and payments on booking detail.
- Tests: 9 adapter unit tests, config guards, a contract-convention guard, and
  7 MySQL integration tests for the full payment flow.
- `docs/operations/SSLCOMMERZ_INTEGRATION.md`: step-by-step switch-on guide
  and sandbox checklist.

### Added — Phase 4 booking engine and customer flow (2026-11-04)

- API: `POST /bookings` (hotel and tour) with an inventory hold, `Idempotency-Key`,
  row locks, server-side price revalidation (`409 price-changed`) and
  `409 not-available`; `GET /quotes/hotel`, `GET /quotes/tour`;
  `GET /hotels/{slug}/offers`; `POST /me/bookings/{id}/cancel`; hold-expiry
  sweeper; holds released on expiry, cancellation or failure (ADR-0018).
- Booking detail now carries the price breakdown, items, travellers, contact
  and hold expiry.
- Web: stay results, property page with priced rooms, tour list with a
  departure picker, checkout with traveller details, sign in / create account,
  and My trips with a live hold countdown and cancel. The homepage search now
  opens real results.
- Demo catalog seed for the pre-launch server, removable in one command (ADR-0021).

### Added — Phase 3 completion (2026-11-04)

- Admin: staff sign-in screen; every console page needs a staff session. The
  dashboard, bookings list (server filters, keyset pages), booking detail with
  an audited status-change form, Staff and roles, and Audit log all use live
  API data. The sample data file is gone.
- API: `GET /admin/dashboard`, `GET/POST /admin/staff`, `PATCH /admin/staff/{id}`
  (only owners grant the owner role, no self-demotion, last-owner protection,
  disabling revokes sessions), `GET /admin/audit`.
- `packages/api-client` generated from the OpenAPI document (ADR-0020); shared
  accessible form fields and a Zod resolver in `packages/ui`.
- Tests: 9 MySQL 8.4 integration tests (concurrent last-room race, idempotent
  replay, price change, cancel/expiry release, CHECK constraint, staff rules)
  plus a CI job that runs them on the official MySQL 8.4.13 tarball (no
  containers); 8 new unit tests.
- HTTPS on :8443 with a self-signed certificate (`infra/server/enable-https.sh`,
  ADR-0019); the deploy agent now waits for both CI jobs.

### Fixed

- CI race: `@pegah/db` build and typecheck both ran `prisma generate` in
  parallel, so a typecheck could read a half-written client. Typecheck now
  reuses the build output and turbo runs it after the build.

- The OpenAPI document described nullable strings as arrays (since Phase 3);
  contracts now use `nullableText()` (ADR-0020).
- The booking detail field `guests` (count) collided with the traveller list;
  the list is now `travellers`.

### Added — Phase 3 backend foundation (2026-11-04)

- `packages/contracts`: Zod schemas for money, problem details, pagination,
  permissions, staff roles, auth, bookings, catalog and health.
- `packages/db`: Prisma 7 schema (22 tables) and initial MySQL migration with
  CHECK constraints against overbooking and inconsistent totals.
- `apps/api` (NestJS 11 + Fastify): health probes; customer and staff auth
  (Argon2id, hashed server-side sessions, HMAC CSRF, Origin allow-list);
  permission guard; catalog, hotel search with server-computed prices, tours;
  customer and admin booking reads; booking state machine with history and
  audit; RFC 9457 errors; Helmet; strict CORS; rate limits; OpenAPI export.
- Operator CLIs: `seed:rbac`, `staff:create`, `seed:sample`.
- 52 new tests (pricing, state machine, availability, dates, config, HTTP).
- CI: OpenAPI drift check. ADR-0013, ADR-0014, ADR-0015.

### Security

- Fastify forced to 5.12.7 (high advisory in 5.11.3 pinned by
  `@nestjs/platform-fastify`); js-yaml 5.4.3 under `@nestjs/swagger`;
  Vitest 4.1.12 (critical tinypool advisory in 3.x); Turborepo 2.11.10.

### Added — Phase 2 code (2026-11-04)

- npm-workspaces + Turborepo monorepo with pinned toolchain (ADR-0011).
- `packages/design-tokens`, `packages/ui`, `packages/shared` (with 17 unit tests).
- `apps/web`: Next.js homepage built from the approved v2 design.
- `apps/admin`: Next.js admin dashboard, bookings list and module placeholders.
- GitHub Actions CI: format, lint, typecheck, unit tests, build.

### Changed

- 2026-11-04 — Primary colour is now `#FF852F` with accessible text variants
  (ADR-0010); caption colour darkened to pass WCAG AA.
- 2026-11-04 — Homepage prototype v2: immersive, booking-first layout with
  hero slideshow, trending carousel, mood mosaic, stay cards and newsletter;
  six new licensed photos (Sundarbans, Boga Lake, Kaptai, Nafakhum, Panam
  City, Lawachara, Saint Martin's); two unused photos removed.

### Added

- 2026-11-04 — Phase 1 documentation: `CLAUDE.md`, product requirements,
  system architecture, ADR-0001…0009, database design, API conventions,
  security model, test strategy, deployment, backup/recovery, runbook,
  project status and feature matrix.
- 2026-11-04 — Kantha design system draft and static homepage prototype with
  licensed Wikimedia Commons photography and image credits.
- 2026-11-04 — Repository hygiene: `.gitignore`, `.gitattributes`,
  `.editorconfig`, pull request template with change-impact checklist.
