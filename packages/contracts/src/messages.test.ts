import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BookingContactSchema, GuestInputSchema, PasswordSchema } from "./index";

const message = (schema: z.ZodType, value: unknown) =>
  schema.safeParse(value).error?.issues[0]?.message;

describe("validation messages", () => {
  it("are plain English instead of Zod's internal wording", () => {
    expect(message(GuestInputSchema, { fullName: "", ageGroup: "ADULT" })).toBe(
      "Enter at least 2 characters.",
    );
    expect(message(PasswordSchema, "short")).toBe("Enter at least 10 characters.");
    expect(message(z.string().max(3), "abcd")).toBe("Use at most 3 characters.");
    expect(message(z.email(), "nope")).toBe("Enter a valid email address.");
    expect(message(z.object({ a: z.string() }), {})).toBe("Required.");
    expect(message(z.enum(["A", "B"]), "C")).toBe("Choose one of the options.");
  });

  it("never override a schema's own message", () => {
    expect(
      message(BookingContactSchema, { name: "Ana", email: "a@b.co", phone: "123" }),
    ).not.toMatch(/Too small|expected/);
    expect(message(z.string().min(5, "Custom"), "a")).toBe("Custom");
  });
});
