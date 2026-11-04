import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Minimal React Hook Form resolver for the shared Zod contracts, so forms
 * validate with exactly the rules the API enforces (the API still re-checks).
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType): Resolver<T> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data as T, errors: {} };
    const nested: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      // Nest dotted paths ("contact.email") the way React Hook Form expects.
      const keys = issue.path.length > 0 ? issue.path.map(String) : ["root"];
      let node = nested;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) {
          node[k] ??= { type: issue.code, message: issue.message };
        } else {
          node = (node[k] ??= {}) as Record<string, unknown>;
        }
      });
    }
    return { values: {}, errors: nested as FieldErrors<T> };
  };
}
