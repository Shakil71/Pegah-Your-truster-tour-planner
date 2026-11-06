"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo, ThemeToggle, cx } from "@pegah/ui";
import { LanguageSwitch } from "@/components/language-switch";
import { browserApi, csrf } from "@/lib/api-browser";

export function PartnerShell({
  partnerName,
  kind,
  userName,
  csrfToken,
  children,
}: {
  partnerName: string;
  kind: "SUPPLIER" | "AGENT";
  userName: string;
  csrfToken: string;
  children: ReactNode;
}) {
  const t = useTranslations("partner");
  const th = useTranslations("header");
  const path = usePathname();
  const router = useRouter();
  const nav =
    kind === "SUPPLIER"
      ? [
          { href: "/partner", label: t("nav.overview") },
          { href: "/partner/reservations", label: t("nav.reservations") },
          { href: "/partner/account", label: t("nav.account") },
        ]
      : [
          { href: "/partner", label: t("nav.overview") },
          { href: "/stays", label: t("nav.findStays") },
          { href: "/tours", label: t("nav.findTours") },
          { href: "/partner/bookings", label: t("nav.clientBookings") },
          { href: "/partner/statement", label: t("nav.statement") },
          { href: "/partner/account", label: t("nav.account") },
        ];

  async function signOut() {
    await browserApi.POST("/api/v1/partner/auth/logout", { headers: csrf(csrfToken) });
    router.replace("/partner/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-rule bg-night text-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/partner" className="flex items-center gap-3 no-underline">
            <Logo tone="light" className="h-10" />
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/75">
              {t(`kind.${kind}`)}
            </span>
          </Link>
          <nav aria-label={t("navLabel")} className="flex flex-1 flex-wrap gap-1">
            {nav.map((n) => {
              const active = n.href === "/partner" ? path === "/partner" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-[0.86rem] font-semibold no-underline",
                    active ? "bg-white/15 text-white" : "text-white/70 hover:text-white",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <span className="text-[0.8rem] text-white/70">
            {userName} · {partnerName}
          </span>
          <LanguageSwitch className="text-[0.8rem]" />
          <ThemeToggle
            className="size-8 hover:bg-white/15"
            labels={{ toDark: th("toDark"), toLight: th("toLight") }}
          />
          <button
            type="button"
            onClick={signOut}
            className="rounded-full border border-white/30 px-3 py-1 text-[0.8rem] font-semibold hover:bg-white hover:text-night"
          >
            {t("signOut")}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
