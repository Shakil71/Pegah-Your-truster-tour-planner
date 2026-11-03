# Design System — "Kantha"

Status: **direction approved (ADR-0007); tokens drafted in the static
prototype; not yet extracted into `packages/design-tokens`.**

Reference implementation: [`prototype/index.html`](prototype/index.html).

## Idea

Pegah borrows one thing from nakshi kantha embroidery: the **running stitch**.
It is the system's only ornament, used for dividers, the active tab, focus
rings and step progress. Everything else stays quiet so destination
photography carries the colour.

## Tokens (draft)

### Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#f3f4f8` | `#10142b` | Page background |
| `--paper-2` | `#e8eaf2` | `#171c3a` | Hover, image placeholder |
| `--card` | `#ffffff` | `#1b2145` | Search panel, cards |
| `--ink` | `#1c2452` | `#e9ebf5` | Text, primary buttons |
| `--ink-2` | `#4a5178` | `#aab0cf` | Secondary text |
| `--madder` | `#b23a2e` | `#e0705f` | Stitch lines, labels, hover on primary actions |
| `--thread` | `#a8822f` | `#d7b265` | Secondary stitch, "now" and sample markers |
| `--rule` | `#d3d7e6` | `#2d3460` | Hairlines, dashed field separators |

Rules: madder never fills large areas; it marks. No gradients except photo
scrims. No raw hex in components.

### Typography

| Role | Family | Notes |
| --- | --- | --- |
| Display | Bodoni Moda (opsz) | Headlines ≥ 1.3 rem only; italic in madder for one emphasised word |
| Text / UI | Hanken Grotesk | 16 px base, 1.6 line height |
| Bangla display | Noto Serif Bengali | Season names; future Bangla headings |
| Bangla text | Hind Siliguri | Planned for localisation |

Scale: 0.72 (labels, uppercase +0.14em) · 0.88 · 1 · 1.3 · 1.55 · 2 · 3.1 · 5.4 rem.
Digits use `tabular-nums lining-nums` wherever prices or dates align.

### Spacing, radius, motion

- Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72 · 112 px.
- Radius: 2 px (controls), 6 px (rare); cards are square-cornered.
- Motion: 140 ms (hover), 260 ms (image zoom), `cubic-bezier(.2,.7,.2,1)`;
  all motion disabled under `prefers-reduced-motion`.

## Components shown in the prototype

Header with sticky blur · hero (copy + full-bleed photo) · tabbed search with
guests stepper popover · six-season selector (ritu) · destination cards ·
featured tour card with departure chips · compact tour rows · full-bleed
"field notes" band · promise columns · footer with photo credits.

## Still to design (Phase 2)

Date-range picker, results list and filters, property page, room selector,
checkout steps, account pages, admin shell, empty/error/skeleton states,
notifications, dialogs, tables.

## Accessibility notes

- Dashed madder focus outline on every interactive element.
- Tabs follow the ARIA tabs pattern with arrow-key navigation.
- Photos carry descriptive alt text; decorative band image uses empty alt.
- Contrast of `--ink-2` on `--paper` must be verified with tooling in Phase 2.
