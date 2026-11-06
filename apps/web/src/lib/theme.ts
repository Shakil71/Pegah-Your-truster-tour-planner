import { cookies } from "next/headers";
import { THEME_COOKIE, type ThemeChoice } from "@pegah/ui";

/** The visitor's saved colour theme, or undefined to follow the system (tokens.css). */
export async function savedTheme(): Promise<ThemeChoice | undefined> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : undefined;
}
