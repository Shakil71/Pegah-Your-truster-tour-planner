import type { IconName } from "@pegah/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  phase?: string;
};

/** Admin modules from PRODUCT_REQUIREMENTS §Admin. `phase` marks modules not built yet. */
export const navGroups: Array<{ title: string; items: NavItem[] }> = [
  { title: "Overview", items: [{ href: "/", label: "Dashboard", icon: "grid" }] },
  {
    title: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: "ticket", badge: 9 },
      { href: "/customers", label: "Customers", icon: "users", phase: "Phase 6" },
      { href: "/inventory", label: "Hotel inventory", icon: "building", phase: "Phase 6" },
      { href: "/tours", label: "Tours", icon: "route", phase: "Phase 6" },
      { href: "/payments", label: "Payments", icon: "card", phase: "Phase 5" },
      { href: "/refunds", label: "Refunds", icon: "refund", badge: 7, phase: "Phase 5" },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/promotions", label: "Promotions", icon: "tag", phase: "Phase 6" },
      { href: "/content", label: "Content", icon: "layout", phase: "Phase 6" },
      { href: "/reports", label: "Reports", icon: "chart", phase: "Phase 6" },
    ],
  },
  {
    title: "Partners",
    items: [
      { href: "/suppliers", label: "Suppliers", icon: "handshake", phase: "Phase 7" },
      { href: "/agents", label: "B2B agents", icon: "users", phase: "Phase 7" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/staff", label: "Staff and roles", icon: "key", phase: "Phase 3" },
      { href: "/audit", label: "Audit log", icon: "log", phase: "Phase 3" },
      { href: "/settings", label: "Settings", icon: "settings", phase: "Phase 6" },
    ],
  },
];

export const plannedSections = navGroups.flatMap((g) => g.items).filter((i) => i.phase);
