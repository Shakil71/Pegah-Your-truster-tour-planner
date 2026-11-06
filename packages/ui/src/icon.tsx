import type { SVGProps } from "react";
import { cx } from "./cx";

/** 24×24 line icons drawn for Pegah (1.6 px stroke, round joins). */
const paths = {
  bed: "M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01",
  boat: "M3 15h18l-2.5 4h-13zM6 15V9h9l3 6M10 9V5",
  plane:
    "M10.5 13.5 4 11l1-2 7 1 4-4.5a1.8 1.8 0 0 1 2.5 2.5L14 12l1 7-2 1-2.5-6.5L8 16v3l-1.5.5L5 17l-1.5-1.5L4 14h3z",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h6M9.5 15.5h6",
  pin: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6",
  calendar:
    "M5.5 5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3.5 10h17M8 3v4M16 3v4",
  user: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5",
  users:
    "M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3 19.5c.7-3.2 3-5 6-5s5.3 1.8 6 5M16 5a3 3 0 0 1 0 6M18 14.6c1.6.6 2.6 2.1 3 4.4",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  taka: "M7 4c2 0 3 1 3 3v9a3 3 0 0 0 6 0v-1M6 9h8M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19",
  shield: "M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6zM8.5 12l2.5 2.5 4.5-5",
  chat: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5",
  wallet:
    "M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM3 10h18M16 14.5h2",
  wifi: "M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01",
  cup: "M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3",
  view: "m2 18 6-8 4 5 3-3 7 6zM16.5 7.5a1.5 1.5 0 1 0 0-.01",
  car: "M4 16v-4l2-5h12l2 5v4zM4 16v2M20 16v2M4 12h16",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  ticket: "M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6H3zM14 6v12",
  building: "M4 21V5l8-2v18M12 8h8v13M7.5 8h1M7.5 12h1M7.5 16h1M15.5 12h1M15.5 16h1M2 21h20",
  route:
    "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a3 3 0 0 1 3-3h4M18 9v6a3 3 0 0 1-3 3h-4",
  card: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M7 15h4",
  refund: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l2.5 2.5",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5a1 1 0 1 0 0-.01",
  handshake: "M3 12l4-4 5 3 3-3 6 4M7 8l-4 4 6 6 2-2M14 17l2 2 5-5",
  layout: "M4 4h16v16H4zM4 9h16M9 9v11",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  key: "M15 9a4 4 0 1 1-3.2 6.4L4 23H1v-3l2-2h2v-2h2l1.6-1.6A4 4 0 0 1 15 9zM16.5 7.5v.01",
  log: "M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h3",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1-2 3.4-1.8-.7a7 7 0 0 1-2.2 1.3L14.7 20.5h-4l-.3-2a7 7 0 0 1-2.2-1.3l-1.8.7-2-3.4 1.6-1a7 7 0 0 1 0-2.6l-1.6-1 2-3.4 1.8.7A7 7 0 0 1 10.4 6l.3-2h4l.3 2a7 7 0 0 1 2.2 1.3l1.8-.7 2 3.4-1.6 1a7 7 0 0 1 0 2.5z",
  pulse: "M3 12h4l2-5 4 10 2-5h6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alert: "M12 4 2.5 20h19zM12 10v4.5M12 17.5v.01",
  x: "M6 6l12 12M18 6 6 18",
  trendUp: "M3 17l6-6 4 4 7-7M14 8h6v6",
  trendDown: "M3 7l6 6 4-4 7 7M14 16h6v-6",
  menu: "M4 7h16M4 12h16M4 17h16",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  filter: "M4 5h16l-6 7.5V19l-4 1.5v-8z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  gift: "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-1.5-3-5.5-4-5.5-1.5S10 8 12 8zM12 8c1.5-3 5.5-4 5.5-1.5S14 8 12 8z",
  megaphone: "M3 10v4h3l9 5V5L6 10zM18 9a4 4 0 0 1 0 6M6 14l1.5 6h3L9 15",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
} as const;

export type IconName = keyof typeof paths;

type Props = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  /** Accessible label. Omit for decorative icons (aria-hidden). */
  label?: string;
};

export function Icon({ name, label, className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("size-5 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
