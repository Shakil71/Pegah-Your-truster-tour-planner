import { z } from "zod";

/**
 * Plain-English validation messages for every schema in the platform.
 * Customers, partners and staff see these under form fields, and the API
 * returns them in problem details. A schema-specific message (passed to
 * `.min(…, "…")`, `.regex(…, "…")` and so on) always wins over these.
 */
export function friendlyMessage(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case "too_small": {
      const n = Number(issue.minimum);
      if (issue.origin === "string") {
        return n <= 1 ? "Required." : `Enter at least ${n} characters.`;
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return n <= 1 ? "Add at least one." : `Add at least ${n}.`;
      }
      return `Must be ${issue.inclusive === false ? "more than" : "at least"} ${n}.`;
    }
    case "too_big": {
      const n = Number(issue.maximum);
      if (issue.origin === "string") return `Use at most ${n} characters.`;
      if (issue.origin === "array" || issue.origin === "set") return `No more than ${n}.`;
      return `Must be ${issue.inclusive === false ? "less than" : "at most"} ${n}.`;
    }
    case "invalid_format":
      if (issue.format === "email") return "Enter a valid email address.";
      if (issue.format === "url") return "Enter a full web address (https://…).";
      return "This format is not valid.";
    case "invalid_type":
      return issue.input === undefined || issue.input === null || issue.input === ""
        ? "Required."
        : "This value is not valid.";
    case "invalid_value":
      return "Choose one of the options.";
    case "not_multiple_of":
      return "This number is not allowed.";
    default:
      return undefined;
  }
}

const bnNumber = (n: number) => n.toLocaleString("bn-BD");

/** The same messages in Bangla, for the website when the visitor chose Bangla (ADR-0028). */
export function friendlyMessageBn(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case "too_small": {
      const n = Number(issue.minimum);
      if (issue.origin === "string") {
        return n <= 1 ? "এটি পূরণ করুন।" : `অন্তত ${bnNumber(n)} অক্ষর লিখুন।`;
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return n <= 1 ? "অন্তত একটি যোগ করুন।" : `অন্তত ${bnNumber(n)}টি যোগ করুন।`;
      }
      return issue.inclusive === false
        ? `${bnNumber(n)}-এর বেশি হতে হবে।`
        : `অন্তত ${bnNumber(n)} হতে হবে।`;
    }
    case "too_big": {
      const n = Number(issue.maximum);
      if (issue.origin === "string") return `সর্বোচ্চ ${bnNumber(n)} অক্ষর লিখুন।`;
      if (issue.origin === "array" || issue.origin === "set") return `${bnNumber(n)}টির বেশি নয়।`;
      return issue.inclusive === false
        ? `${bnNumber(n)}-এর কম হতে হবে।`
        : `সর্বোচ্চ ${bnNumber(n)} হতে পারে।`;
    }
    case "invalid_format":
      if (issue.format === "email") return "সঠিক ইমেইল ঠিকানা লিখুন।";
      if (issue.format === "url") return "পুরো ওয়েব ঠিকানা লিখুন (https://…)।";
      return "এই ফরম্যাট সঠিক নয়।";
    case "invalid_type":
      return issue.input === undefined || issue.input === null || issue.input === ""
        ? "এটি পূরণ করুন।"
        : "এই মানটি সঠিক নয়।";
    case "invalid_value":
      return "তালিকা থেকে একটি বেছে নিন।";
    case "not_multiple_of":
      return "এই সংখ্যাটি গ্রহণযোগ্য নয়।";
    default:
      return undefined;
  }
}

z.config({ customError: friendlyMessage });
