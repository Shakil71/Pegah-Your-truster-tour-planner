import type { IconName } from "@pegah/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  phase?: string;
  /** Hidden for staff without this permission (the API enforces it regardless). */
  permission?: string;
};

/** Admin modules from PRODUCT_REQUIREMENTS §Admin. `phase` marks modules not built yet. */
export const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: "grid", permission: "dashboard:read" }],
  },
  {
    title: "Operations",
    items: [
      { href: "/bookings", label: "Bookings", icon: "ticket", permission: "booking:read" },
      { href: "/customers", label: "Customers", icon: "users", phase: "Phase 6" },
      { href: "/inventory", label: "Hotel inventory", icon: "building", phase: "Phase 6" },
      { href: "/tours", label: "Tours", icon: "route", phase: "Phase 6" },
      { href: "/payments", label: "Payments", icon: "card", phase: "Phase 5" },
      { href: "/refunds", label: "Refunds", icon: "refund", phase: "Phase 5" },
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
      { href: "/staff", label: "Staff and roles", icon: "key", permission: "user:manage" },
      { href: "/audit", label: "Audit log", icon: "log", permission: "audit:read" },
      { href: "/settings", label: "Settings", icon: "settings", phase: "Phase 6" },
    ],
  },
];

export const plannedSections = navGroups.flatMap((g) => g.items).filter((i) => i.phase);
