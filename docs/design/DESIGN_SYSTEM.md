# Design System — "Kantha"

Status: **tokens implemented in `packages/design-tokens` (CSS variables +
Tailwind v4 theme); core components in `packages/ui`; homepage and admin
dashboard built in Next.js.** Primary colour changed to `#FF852F` (ADR-0010).

Source of truth: [`packages/design-tokens/tokens.css`](../../packages/design-tokens/tokens.css).
The colour table below is a summary; if they differ, the CSS file wins.
Historical static reference: [`prototype/index.html`](prototype/index.html)
(uses the earlier madder accent).

## Primary colour rules (ADR-0010)

| Use                                         | Token                     | Value     | Contrast                             |
| ------------------------------------------- | ------------------------- | --------- | ------------------------------------ |
| Fills: buttons, badges, stitch, chart marks | `--pg-primary`            | `#ff852f` | decorative / with indigo text 6.07:1 |
| Text on a primary fill                      | `--pg-on-primary`         | `#1c2452` | 6.07:1                               |
| Orange text on light surfaces               | `--pg-primary-ink`        | `#b5520f` | 5.03:1 on white                      |
| Orange text on dark surfaces                | `--pg-primary-ink` (dark) | `#ffa365` | 9.24:1 on night                      |
| Soft tint backgrounds                       | `--pg-primary-soft`       | `#fff0e4` | —                                    |

Never place white text on `#ff852f`.

## Idea

Pegah borrows one thing from nakshi kantha embroidery: the **running stitch**.
It is the system's only ornament, used for dividers, the active tab, focus
rings and step progress. Everything else stays quiet so destination
photography carries the colour.

## Tokens (draft)

### Colour

| Token                                    | Light          | Dark           | Use                                                |
| ---------------------------------------- | -------------- | -------------- | -------------------------------------------------- |
| `--paper`                                | `#f3f4f8`      | `#10142b`      | Page background                                    |
| `--paper-2`                              | `#e8eaf2`      | `#171c3a`      | Hover, image placeholder                           |
| `--card`                                 | `#ffffff`      | `#1b2145`      | Search panel, cards                                |
| `--ink`                                  | `#1c2452`      | `#e9ebf5`      | Text, primary buttons                              |
| `--ink-2`                                | `#4a5178`      | `#aab0cf`      | Secondary text                                     |
| `--pg-primary`                           | `#ff852f`      | `#ff852f`      | Primary actions, stitch lines, badges, chart marks |
| `--pg-ink-3`                             | `#5a6080`      | `#8d94b8`      | Captions (≥ 4.5:1 on card, paper and paper-2)      |
| `--pg-thread`                            | `#a8822f`      | `#a8822f`      | Borders and decoration only (3.6:1)                |
| `--pg-thread-ink`                        | `#7d5d1c`      | `#d4b26a`      | "Sample" and "soon" marker text (≥ 5.1:1)          |
| `--pg-on-night`, `--pg-on-night-2`       | fixed          | fixed          | Text on always-dark panels (footer, sidebar)       |
| `--pg-fixed-ink / accent / good / heart` | fixed          | fixed          | Text on white chips over photos; never theme-swap  |
| `--pg-rule`                              | `#d8dbe8`      | `#2b3263`      | Hairlines, dashed field separators                 |
| `--pg-good / warn / critical / info`     | see tokens.css | see tokens.css | Booking status only, always with icon + label      |

Rules: no gradients except photo scrims and the admin greeting glow. No raw
hex in components: surfaces that must not change with the theme (photos,
always-dark panels) use the fixed tokens above. Every page is scanned with axe
(WCAG 2.1 AA) in the end-to-end suite. Occupancy heatmaps use `sequentialPrimary` from
`@pegah/design-tokens` (single hue, light → dark).

### Typography

| Role           | Family             | Notes                                                              |
| -------------- | ------------------ | ------------------------------------------------------------------ |
| Display        | Bodoni Moda (opsz) | Headlines ≥ 1.3 rem only; italic in madder for one emphasised word |
| Text / UI      | Hanken Grotesk     | 16 px base, 1.6 line height                                        |
| Bangla display | Noto Serif Bengali | Season names; future Bangla headings                               |
| Bangla text    | Hind Siliguri      | In use on the Bangla website (ADR-0028); no italics for Bengali    |

Scale: 0.72 (labels, uppercase +0.14em) · 0.88 · 1 · 1.3 · 1.55 · 2 · 3.1 · 5.4 rem.
Digits use `tabular-nums lining-nums` wherever prices or dates align.

### Spacing, radius, motion

- Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 · 112 px.
- Radius: 2 px (controls), 6 px (rare); cards are square-cornered.
- Motion: 140 ms (hover), 260 ms (image zoom), `cubic-bezier(.2,.7,.2,1)`;
  all motion disabled under `prefers-reduced-motion`.

## Components shown in the prototype (v2, immersive)

Owner feedback on v1 (2026-11-04): it needed to feel more striking and more
clearly like a booking site. v2 keeps the Kantha palette, type and stitch but
leads with photography.

Transparent-to-solid header · full-bleed hero slideshow with crossfade, slow
drift, stitch-line progress indicators and a pause control · search card
straddling the fold (Stays, Tours, Flights soon, Visa soon; icon fields,
guests stepper, quick-pick chips) · trust strip · trending carousel with
scroll-snap and arrow controls · "explore by mood" photo mosaic · stay cards
(wishlist, free-cancellation badge, stitched score, amenities, price incl.
VAT) · six-season panel with crossfading photo · featured tour with departure
chips and compact trip cards · promise cards · newsletter band · footer with
payment marks and photo credits.

Radius changed in v2: 10 px for controls, 18 px for photo cards and panels.

## Still to design (Phase 2)

Date-range picker, results list and filters, property page, room selector,
checkout steps, account pages, admin shell, empty/error/skeleton states,
notifications, dialogs, tables.

## Accessibility notes

- Dashed madder focus outline on every interactive element.
- Tabs follow the ARIA tabs pattern with arrow-key navigation.
- Photos carry descriptive alt text; decorative band image uses empty alt.
- Contrast of `--ink-2` on `--paper` must be verified with tooling in Phase 2.
