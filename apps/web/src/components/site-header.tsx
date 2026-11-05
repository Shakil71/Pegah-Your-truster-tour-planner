"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon, Logo, cx } from "@pegah/ui";
import { browserApi } from "@/lib/api-browser";
import { useScrolledPast } from "@/lib/use-browser";
import { LanguageSwitch } from "./language-switch";

const nav = [
  { href: "/stays", key: "stays" },
  { href: "/tours", key: "tours" },
  { href: "/#explore", key: "destinations" },
  { href: "/about", key: "about" },
] as const;

/** Transparent over the hero photo (home), solid once the page scrolls or on inner pages. */
export function SiteHeader({ solid: alwaysSolid = false }: { solid?: boolean }) {
  const t = useTranslations("header");
  const scrolled = useScrolledPast(40);
  const solid = alwaysSolid || scrolled;
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void browserApi.GET("/api/v1/auth/session").then(({ data }) => {
      if (live && data) setName(data.user.fullName.split(" ")[0] ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50 px-[max(16px,env(safe-area-inset-left,0px))] transition-[background-color,color,box-shadow] duration-300",
        solid ? "bg-card text-ink shadow-[0_1px_0_var(--pg-rule)]" : "text-white",
      )}
    >
      {/* Three columns so the menu sits in the true centre, whatever the widths of the logo and actions. */}
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[1fr_auto] items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <Link href="/" aria-label={t("home")} className="no-underline">
            <Logo tone={solid ? "dark" : "light"} className="h-11" />
          </Link>
        </div>
        <nav aria-label={t("mainNav")} className="hidden md:block">
          <ul className="flex gap-8 text-[0.94rem] font-medium">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="border-b-2 border-transparent py-1.5 no-underline hover:border-current"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
            <li>
              <span className="py-1.5 opacity-80">
                {t("flights")}
                <sup className="ml-1 text-[0.58rem] uppercase tracking-wider">{t("soon")}</sup>
              </span>
            </li>
          </ul>
        </nav>
        <div className="flex items-center gap-4 justify-self-end text-sm">
          <span className="tabular hidden md:inline">৳ BDT</span>
          <LanguageSwitch />
          <Link
            href={name ? "/account/bookings" : "/login"}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current px-4 py-[7px] font-semibold no-underline transition-colors",
              solid ? "hover:bg-ink hover:text-card" : "hover:bg-white hover:text-night",
            )}
          >
            <Icon name="user" className="size-4" />
            {name ? t("myTrips", { name }) : t("signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}
