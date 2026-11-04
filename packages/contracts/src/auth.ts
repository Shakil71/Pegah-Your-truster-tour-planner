import { z } from "zod";
import { PublicIdSchema } from "./common";
import { PermissionSchema } from "./permissions";

/** Email is normalised (trimmed, lower-cased) before it reaches the API logic. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

/**
 * Length is the main strength control (NIST SP 800-63B): at least 10
 * characters, at most 128 so hashing cost stays bounded.
 */
export const PasswordSchema = z.string().min(10).max(128);

/** Bangladeshi mobile number in +8801XXXXXXXXX form. */
export const BdPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+8801[3-9]\d{8}$/, "Use the form +8801XXXXXXXXX");

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  fullName: z.string().trim().min(2).max(120),
  phone: BdPhoneSchema.optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  // Not validated for strength on login: any string up to the hashing cap.
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionKindSchema = z.enum(["CUSTOMER", "STAFF"]);
export type SessionKind = z.infer<typeof SessionKindSchema>;

export const SessionUserSchema = z
  .object({
    id: PublicIdSchema,
    email: z.string(),
    fullName: z.string(),
    phone: z.string().nullable(),
    kind: SessionKindSchema,
    roles: z.array(z.string()),
    permissions: z.array(PermissionSchema),
  })
  .meta({ id: "SessionUser" });
export type SessionUser = z.infer<typeof SessionUserSchema>;

/**
 * Returned by register, login and GET /auth/session. The CSRF token must be
 * echoed in the `X-CSRF-Token` header on every cookie-authenticated mutation.
 */
export const SessionResponseSchema = z.object({
  user: SessionUserSchema,
  csrfToken: z.string(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const CSRF_HEADER = "x-csrf-token";
