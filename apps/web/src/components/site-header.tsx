"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon, Logo, ThemeToggle, cx } from "@pegah/ui";
import { browserApi } from "@/lib/api-browser";
import { useScrolledPast } from "@/lib/use-browser";
import { LanguageSwitch } from "./language-switch";

const nav = [
  { href: "/hotels", key: "hotels" },
  { href: "/stays", key: "stays" },
  { href: "/tours", key: "tours" },
  { href: "/flights", key: "flights" },
  { href: "/visa", key: "visa" },
  { href: "/offers", key: "offers" },
  { href: "/gift-cards", key: "giftCards" },
  { href: "/about", key: "about" },
] as const;

/** Transparent over the hero photo (home), solid once the page scrolls or on inner pages. */
export function SiteHeader({ solid: alwaysSolid = false }: { solid?: boolean }) {
  const t = useTranslations("header");
  const scrolled = useScrolledPast(40);
  const solid = alwaysSolid || scrolled;
  const [name, setName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

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
        solid || menuOpen ? "bg-card text-ink shadow-[0_1px_0_var(--pg-rule)]" : "text-white",
      )}
    >
      {/* Three columns so the menu sits in the true centre, whatever the widths of the logo and actions. */}
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[1fr_auto] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <Link href="/" aria-label={t("home")} className="no-underline">
            <Logo tone={solid || menuOpen ? "auto" : "light"} className="h-11" />
          </Link>
        </div>
        <nav aria-label={t("mainNav")} className="hidden lg:block">
          <ul className="flex gap-5 text-[0.94rem] font-medium xl:gap-7">
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
          </ul>
        </nav>
        <div className="flex items-center gap-3 justify-self-end text-sm sm:gap-4">
          <span className="tabular hidden xl:inline">৳ BDT</span>
          <LanguageSwitch />
          <ThemeToggle
            labels={{ toDark: t("toDark"), toLight: t("toLight") }}
            className={cx("-mx-2", solid ? "hover:bg-paper-2" : "hover:bg-white/15")}
          />
          <Link
            href={name ? "/account/bookings" : "/login"}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current px-4 py-[7px] font-semibold no-underline transition-colors",
              solid ? "hover:bg-ink hover:text-card" : "hover:bg-white hover:text-night",
            )}
          >
            <Icon name="user" className="size-4" />
            <span className="hidden sm:inline">{name ? t("myTrips", { name }) : t("signIn")}</span>
            <span className="sr-only sm:hidden">{name ? t("myTrips", { name }) : t("signIn")}</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            className={cx(
              "-mr-2 grid size-10 place-items-center rounded-full lg:hidden",
              solid || menuOpen ? "hover:bg-paper-2" : "hover:bg-white/15",
            )}
          >
            <Icon name={menuOpen ? "x" : "menu"} className="size-6" />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="site-menu"
          aria-label={t("mainNav")}
          className="mx-auto max-w-[1280px] border-t border-rule pb-4 lg:hidden"
        >
          <ul className="grid gap-1 pt-2 text-[1rem] font-medium sm:grid-cols-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-[10px] px-3 py-3 no-underline hover:bg-paper-2 aria-[current=page]:text-primary-ink"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
