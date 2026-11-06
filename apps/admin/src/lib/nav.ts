import type { IconName } from "@pegah/ui";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Hidden for staff without this permission (the API enforces it regardless). */
  permission?: string;
};

/** Admin modules from PRODUCT_REQUIREMENTS §Admin. */
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
      {
        href: "/catalog/media",
        label: "Media library",
        icon: "layout",
        permission: "catalog:read",
      },
    ],
  },
  {
    title: "Growth",
    items: [
      { href: "/orders", label: "Orders", icon: "bag", permission: "payment:read" },
      { href: "/gift-cards", label: "Gift cards", icon: "gift", permission: "payment:read" },
      { href: "/offers", label: "Offers", icon: "tag", permission: "promotion:manage" },
      { href: "/ads", label: "Ads", icon: "megaphone", permission: "promotion:manage" },
      { href: "/promotions", label: "Promotions", icon: "tag", permission: "promotion:manage" },
      { href: "/home-page", label: "Home page", icon: "grid", permission: "content:manage" },
      { href: "/content", label: "Content pages", icon: "layout", permission: "content:manage" },
      { href: "/reports", label: "Reports", icon: "chart", permission: "report:read" },
    ],
  },
  {
    title: "Partners",
    items: [
      {
        href: "/partners",
        label: "Suppliers and agents",
        icon: "handshake",
        permission: "partner:manage",
      },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/staff", label: "Staff and roles", icon: "key", permission: "user:manage" },
      { href: "/audit", label: "Audit log", icon: "log", permission: "audit:read" },
      {
        href: "/old-website",
        label: "Old website data",
        icon: "log",
        permission: "legacy:read",
      },
      { href: "/settings", label: "Settings", icon: "settings", permission: "settings:read" },
    ],
  },
];
