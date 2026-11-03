# Product Requirements

Status: approved for Phase 1 on 2026-11-04. Scope changes are recorded in
`docs/architecture/DECISIONS.md`.

## 1. Product

Pegah is a premium, original travel booking platform for Bangladesh, priced in
BDT by default, with multi-currency and multi-language architecture for later
expansion. Brand promise: a trusted tour planner.

## 2. Actors

| Actor                            | Goal                                                               | Surface             | Phase |
| -------------------------------- | ------------------------------------------------------------------ | ------------------- | ----- |
| Guest                            | Discover and price hotels, tours, flights                          | Public web          | 4     |
| Customer                         | Book, pay in BDT, get vouchers and invoices, cancel, track refunds | Public web, account | 4–5   |
| Operations staff                 | Manage bookings, inventory, customers, content                     | Admin               | 6     |
| Finance staff                    | Payments, refunds, reconciliation, reports                         | Admin               | 6     |
| Supplier (hotel / tour operator) | Own inventory, rates, availability, reservations, settlements      | Supplier portal     | 7     |
| B2B agent                        | Book at agent rates, commissions, statements, credit               | Agent portal        | 7     |

## 3. Release slice 1 (first vertical slice)

Directly contracted **hotels and tours**, booked and paid in BDT through one
sandbox payment gateway (SSLCOMMERZ, ADR-0006). Flights and visa follow when
supplier access exists.

### Homepage and discovery

- Premium hero with unified search (stays, tours; flights shown as "coming soon").
- Destination discovery, featured tours, trust and service information, footer.
- Testimonials only when authentic content exists. Newsletter later.

### Hotels

- Search by destination, dates, rooms and guests.
- Listing with filters (price, area, star rating, amenities, free cancellation) and sorting.
- Property page: photos, amenities, rooms, price and tax breakdown, cancellation policy.
- Room selection → traveller details → hold → payment → voucher.

### Tours

- Categories and listing; detail with itinerary, inclusions, exclusions.
- Schedule availability, participant selection, booking, payment, confirmation.

### Customer account

- Register, login, logout, password reset.
- Profile, traveller profiles, booking history, invoices, vouchers.
- Cancellation request and refund status.

### Admin (minimum for slice 1)

- Hotel, room, rate and inventory management; tour and schedule management.
- Bookings, customers, payments, refunds; staff accounts and roles; audit log.

## 4. Later scope

| Area                                                                           | Phase         | Dependency                     |
| ------------------------------------------------------------------------------ | ------------- | ------------------------------ |
| Flights (one-way, round-trip, multi-city, fare rules, revalidation, ticketing) | 8             | GDS or consolidator contract   |
| Visa services (country info, workflow, secure documents, tracking)             | 6–8           | Secure document storage design |
| Third-party hotel inventory                                                    | 8             | Bedbank contract               |
| Coupons, promotions, commissions, CMS, blog, analytics                         | 6             | Admin foundation               |
| Supplier and agent portals                                                     | 7             | Tenant ownership model         |
| Bangla localisation                                                            | after slice 1 | Translations                   |

## 5. Non-functional requirements

- Core Web Vitals at p75: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 (measured).
- WCAG 2.2 AA.
- Money in integer minor units with explicit currency; UTC storage, Asia/Dhaka display.
- English at launch; all user-facing strings via next-intl.
- No booking shown as confirmed without authoritative confirmation.
- Native RHEL deployment, no containers.
