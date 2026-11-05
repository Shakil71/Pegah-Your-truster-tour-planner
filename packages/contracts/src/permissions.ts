import { z } from "zod";

/**
 * Permission keys are defined once here (docs/security/SECURITY_MODEL.md) and
 * checked by API guards. UIs may read them to hide controls, but hiding is a
 * convenience, never a control.
 */
export const PERMISSIONS = {
  "dashboard:read": "View the operations dashboard",
  "booking:read": "View all bookings",
  "booking:manage": "Edit booking details and guests",
  "booking:override_status": "Change a booking status manually (audited)",
  "catalog:read": "View catalog records including drafts",
  "catalog:manage": "Create and edit destinations, hotels, rooms and tours",
  "inventory:manage": "Edit room inventory, rates and tour capacity",
  "customer:read": "View customer profiles",
  "customer:manage": "Disable or enable customer accounts and sign them out (audited)",
  "payment:read": "View payments and payment events",
  "refund:approve": "Approve or reject refunds (audited)",
  "user:manage": "Create staff users and assign roles (audited)",
  "audit:read": "Read the audit log",
  "promotion:manage": "Create and edit coupon codes",
  "report:read": "View and export sales reports",
  "content:manage": "Edit website content pages",
  "partner:manage": "Create suppliers and agents, their users and assignments (audited)",
  "settings:read": "View system settings and integration status (no secrets)",
  "settings:manage": "Edit contact details, the announcement banner and booking times (audited)",
  "settings:secrets": "Configure payment and email credentials (owner; audited)",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];
export const PermissionSchema = z.enum(PERMISSION_KEYS as [Permission, ...Permission[]]);

/** System staff roles. Their default permission sets live in the API seed. */
export const STAFF_ROLES = [
  "owner",
  "admin",
  "operations",
  "finance",
  "content",
  "support",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const StaffRoleSchema = z.enum(STAFF_ROLES);
