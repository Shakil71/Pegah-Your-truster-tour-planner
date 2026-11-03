/**
 * SAMPLE DATA for the admin design build. Deterministic (seeded) so server
 * and client render identically. Replaced by the admin API in Phase 6.
 */
import type { StaticImageData } from "next/image";
import houseboat from "@/assets/images/tanguar-houseboat.jpg";
import sundarbans from "@/assets/images/hero-sundarbans-sunrise.jpg";
import nafakhum from "@/assets/images/nafakhum-falls.jpg";
import ratargul from "@/assets/images/ratargul-boatman.jpg";
import sajek from "@/assets/images/sajek-sunrise.jpg";

/** Mulberry32: tiny deterministic PRNG. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Booking lifecycle states from docs/database/DATABASE_DESIGN.md. */
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "MANUAL_REVIEW"
  | "CANCELLATION_REQUESTED"
  | "REFUND_PENDING"
  | "COMPLETED"
  | "EXPIRED";

export type Booking = {
  ref: string;
  guest: string;
  product: string;
  kind: "Stay" | "Tour";
  checkIn: string;
  nights: number;
  amount: number;
  channel: "Web" | "Mobile web" | "Agent";
  status: BookingStatus;
  createdMinutesAgo: number;
};

const r = rng(20261104);

/** Daily gross booking value (whole taka) for the last 90 days, oldest first. */
export const revenueDaily: number[] = Array.from({ length: 90 }, (_, i) => {
  const weekly = [1.18, 0.86, 0.82, 0.9, 1.04, 1.32, 1.24][i % 7] ?? 1;
  const trend = 1 + i / 160;
  const noise = 0.82 + r() * 0.36;
  return Math.round(118000 * weekly * trend * noise);
});

export const kpis = [
  {
    key: "gbv",
    label: "Gross booking value",
    value: 4268400,
    format: "money" as const,
    delta: 12.4,
    spark: revenueDaily.slice(-14),
    hint: "Last 30 days",
  },
  {
    key: "bookings",
    label: "Confirmed bookings",
    value: 386,
    format: "count" as const,
    delta: 8.1,
    spark: revenueDaily.slice(-14).map((v) => Math.round(v / 11000)),
    hint: "Last 30 days",
  },
  {
    key: "occupancy",
    label: "Avg. occupancy",
    value: 72,
    format: "percent" as const,
    delta: 4.6,
    spark: [61, 63, 60, 66, 68, 64, 70, 71, 69, 73, 72, 74, 71, 72],
    hint: "Next 14 days",
  },
  {
    key: "refunds",
    label: "Refunds pending",
    value: 7,
    format: "count" as const,
    delta: -22.0,
    spark: [12, 11, 13, 10, 9, 11, 10, 9, 8, 9, 8, 7, 8, 7],
    hint: "Awaiting finance",
    invert: true,
  },
];

export const pipeline: Array<{ status: BookingStatus; count: number }> = [
  { status: "PENDING_PAYMENT", count: 23 },
  { status: "PAYMENT_PROCESSING", count: 6 },
  { status: "CONFIRMED", count: 142 },
  { status: "MANUAL_REVIEW", count: 3 },
  { status: "CANCELLATION_REQUESTED", count: 5 },
  { status: "REFUND_PENDING", count: 7 },
];

const guests = [
  "Nusrat Jahan",
  "Tanvir Ahmed",
  "Farhana Akter",
  "Rafiq Islam",
  "Sadia Rahman",
  "Imran Hossain",
  "Mehjabin Chowdhury",
  "Arif Mahmud",
  "Sharmin Sultana",
  "Kamrul Hasan",
  "Laila Begum",
  "Zahid Karim",
  "Ayesha Siddiqua",
  "Mahmudul Haque",
];
const products: Array<[string, Booking["kind"], number]> = [
  ["Tea Estate Bungalow, Srimangal", "Stay", 8400],
  ["Tanguar Haor houseboat", "Tour", 14500],
  ["Marine Drive Sea-View Suites", "Stay", 9900],
  ["Sundarbans launch cruise", "Tour", 16900],
  ["Lakeside Hill Cottage, Ruma", "Stay", 5200],
  ["Kaptai Lake Floating Lodge", "Stay", 6700],
  ["Ratargul by dinghy", "Tour", 3200],
  ["Thanchi to Nafakhum trek", "Tour", 13500],
];
const statuses: BookingStatus[] = [
  "CONFIRMED",
  "CONFIRMED",
  "CONFIRMED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAYMENT_PROCESSING",
  "MANUAL_REVIEW",
  "CANCELLATION_REQUESTED",
  "REFUND_PENDING",
  "COMPLETED",
  "EXPIRED",
];
const channels: Booking["channel"][] = ["Web", "Mobile web", "Mobile web", "Agent"];
const days = [
  "12 Nov",
  "13 Nov",
  "14 Nov",
  "19 Nov",
  "20 Nov",
  "21 Nov",
  "26 Nov",
  "27 Nov",
  "4 Dec",
  "11 Dec",
];

export const bookings: Booking[] = Array.from({ length: 28 }, (_, i) => {
  const [product, kind, base] = products[Math.floor(r() * products.length)]!;
  const nights = kind === "Stay" ? 1 + Math.floor(r() * 3) : 2;
  const pax = kind === "Tour" ? 1 + Math.floor(r() * 3) : 1;
  return {
    ref: `PG-${(48213 + i * 7).toString()}`,
    guest: guests[i % guests.length]!,
    product,
    kind,
    checkIn: days[Math.floor(r() * days.length)]!,
    nights,
    amount: kind === "Stay" ? base * nights : base * pax,
    channel: channels[Math.floor(r() * channels.length)]!,
    status: statuses[Math.floor(r() * statuses.length)]!,
    createdMinutesAgo: Math.round(4 + i * 37 + r() * 20),
  };
});

export type Departure = {
  name: string;
  date: string;
  booked: number;
  capacity: number;
  photo: StaticImageData;
};
export const departures: Departure[] = [
  { name: "Tanguar Haor houseboat", date: "Thu 12 Nov", booked: 5, capacity: 8, photo: houseboat },
  {
    name: "Sundarbans launch cruise",
    date: "Fri 13 Nov",
    booked: 31,
    capacity: 36,
    photo: sundarbans,
  },
  { name: "Sajek sunrise and Konglak", date: "Sat 14 Nov", booked: 9, capacity: 14, photo: sajek },
  { name: "Ratargul by dinghy", date: "Sat 14 Nov", booked: 12, capacity: 12, photo: ratargul },
  {
    name: "Thanchi to Nafakhum trek",
    date: "Thu 19 Nov",
    booked: 4,
    capacity: 10,
    photo: nafakhum,
  },
];

export const properties = [
  "Tea Estate Bungalow",
  "Lakeside Hill Cottage",
  "Marine Drive Suites",
  "Kaptai Floating Lodge",
  "Sajek Ridge Cottages",
  "Inani Beach Villas",
];

/** Occupancy % per property for the next 14 days (weekends busier). */
export function occupancyGrid(startDow: number): number[][] {
  const g = rng(77);
  return properties.map((_, p) =>
    Array.from({ length: 14 }, (_, d) => {
      const dow = (startDow + d) % 7;
      const weekend = dow === 4 || dow === 5 ? 22 : dow === 6 ? 10 : 0;
      return Math.max(8, Math.min(100, Math.round(40 + p * 4 + weekend + g() * 38 - d * 0.6)));
    }),
  );
}

export const activity = [
  {
    icon: "check" as const,
    tone: "good" as const,
    text: "PG-48304 confirmed by Tea Estate Bungalow",
    ago: "2 min",
  },
  {
    icon: "card" as const,
    tone: "info" as const,
    text: "SSLCOMMERZ sandbox payment received for PG-48297",
    ago: "6 min",
  },
  {
    icon: "alert" as const,
    tone: "warn" as const,
    text: "PG-48262 paid but supplier did not confirm: moved to manual review",
    ago: "14 min",
  },
  {
    icon: "refund" as const,
    tone: "info" as const,
    text: "Refund of ৳ 9,900 approved by Finance for PG-48241",
    ago: "38 min",
  },
  {
    icon: "users" as const,
    tone: "good" as const,
    text: "Sundarbans cruise 13 Nov is 86% full",
    ago: "1 h",
  },
  {
    icon: "key" as const,
    tone: "neutral" as const,
    text: "Role ‘Finance’ granted to staff member R. Islam",
    ago: "3 h",
  },
];
