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
      { href: "/customers", label: "Customers", icon: "users", permission: "customer:read" },
      { href: "/payments", label: "Payments", icon: "card", permission: "payment:read" },
      { href: "/refunds", label: "Refunds", icon: "refund", permission: "payment:read" },
    ],
  },
  {
    title: "Catalog",
    items: [
      {
        href: "/catalog/hotels",
        label: "Hotels and rooms",
        icon: "building",
        permission: "catalog:read",
      },
      {
        href: "/catalog/tours",
        label: "Tours and departures",
        icon: "route",
        permission: "catalog:read",
      },
      {
        href: "/catalog/destinations",
        label: "Destinations",
        icon: "pin",
        permission: "catalog:read",
      },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/promotions", label: "Promotions", icon: "tag", phase: "Phase 7" },
      { href: "/content", label: "Content", icon: "layout", phase: "Phase 7" },
      { href: "/reports", label: "Reports", icon: "chart", phase: "Phase 7" },
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
      { href: "/settings", label: "Settings", icon: "settings", phase: "Phase 7" },
    ],
  },
];

export const plannedSections = navGroups.flatMap((g) => g.items).filter((i) => i.phase);
