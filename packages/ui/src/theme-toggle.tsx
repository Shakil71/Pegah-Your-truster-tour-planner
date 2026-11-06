"use client";

import { useEffect, useState } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { THEME_COOKIE, type ThemeChoice } from "./theme";

function effective(): ThemeChoice {
  const attr = document.documentElement.dataset.theme;
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark switch. The server reads the cookie and renders `data-theme` on
 * <html>, so there is no flash; this button flips the attribute instantly and
 * remembers the choice for a year. Labels are passed in so each app can
 * translate them.
 */
export function ThemeToggle({
  className,
  labels = { toDark: "Switch to dark theme", toLight: "Switch to light theme" },
}: {
  className?: string;
  labels?: { toDark: string; toLight: string };
}) {
  const [theme, setTheme] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setTheme(effective());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(effective());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function flip() {
    const next: ThemeChoice = (theme ?? effective()) === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
    setTheme(next);
  }

  const label = theme === "dark" ? labels.toLight : labels.toDark;
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className={cx(
        "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
        className,
      )}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="size-[1.15rem]" />
    </button>
  );
}
