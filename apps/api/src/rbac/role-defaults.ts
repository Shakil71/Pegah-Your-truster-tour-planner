import { PERMISSION_KEYS, type Permission, type StaffRole } from "@pegah/contracts";

/**
 * Default permission sets for the system staff roles. This is a business
 * rule, so it lives in the API; `seed:rbac` writes it to the database.
 * Changing a role's grants here takes effect the next time the seed runs.
 */
export const ROLE_DEFAULTS: Record<
  StaffRole,
  { name: string; description: string; permissions: readonly Permission[] }
> = {
  owner: {
    name: "Owner",
    description: "Full access, including staff and role management.",
    permissions: PERMISSION_KEYS,
  },
  admin: {
    name: "Administrator",
    description:
      "Runs daily operations; cannot approve refunds or change payment and email credentials.",
    permissions: PERMISSION_KEYS.filter((p) => p !== "refund:approve" && p !== "settings:secrets"),
  },
  operations: {
    name: "Operations",
    description: "Handles bookings, inventory and departures.",
    permissions: [
      "dashboard:read",
      "booking:read",
      "booking:manage",
      "booking:override_status",
      "catalog:read",
      "inventory:manage",
      "customer:read",
      "report:read",
      "service:manage",
    ],
  },
  finance: {
    name: "Finance",
    description: "Reconciles payments and approves refunds.",
    permissions: [
      "dashboard:read",
      "booking:read",
      "payment:read",
      "refund:approve",
      "order:manage",
      "audit:read",
      "report:read",
    ],
  },
  content: {
    name: "Content",
    description: "Maintains destinations, hotels, rooms and tours.",
    permissions: [
      "dashboard:read",
      "catalog:read",
      "catalog:manage",
      "content:manage",
      "promotion:manage",
    ],
  },
  support: {
    name: "Customer support",
    description: "Looks up bookings and customers to help travellers.",
    permissions: ["dashboard:read", "booking:read", "customer:read", "service:manage"],
  },
};
