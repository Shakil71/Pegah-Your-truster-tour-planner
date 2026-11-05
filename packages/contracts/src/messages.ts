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

z.config({ customError: friendlyMessage });
