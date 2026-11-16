import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, cx, type IconName } from "@pegah/ui";

/**
 * Account sub-navigation shared by My trips and Profile, with shortcuts to
 * every service. Stays search, Flights and Visa can be hidden from the public
 * menu (ADR-0041), so signed-in customers always reach them from here.
 */
export function AccountTabs({ active }: { active: "trips" | "orders" | "requests" | "profile" }) {
  const t = useTranslations("account");
  const h = useTranslations("header");
  const tabs = [
    { key: "trips", href: "/account/bookings", label: t("myTrips") },
    { key: "orders", href: "/account/orders", label: t("ordersTab") },
    { key: "requests", href: "/account/requests", label: t("requestsTab") },
    { key: "profile", href: "/account/profile", label: t("profileTab") },
  ] as const;
  const services: Array<{ href: string; label: string; icon: IconName }> = [
    { href: "/hotels", label: h("hotels"), icon: "building" },
    { href: "/stays", label: h("stays"), icon: "bed" },
    { href: "/tours", label: h("tours"), icon: "route" },
    { href: "/flights", label: h("flights"), icon: "plane" },
    { href: "/visa", label: h("visa"), icon: "doc" },
    { href: "/contact", label: h("contact"), icon: "chat" },
  ];
  return (
    <div className="grid gap-3">
      <nav
        aria-label={t("label")}
        className="flex flex-wrap gap-1 rounded-[22px] border border-rule bg-card p-1 sm:w-fit"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={cx(
              "flex-1 rounded-full px-4 py-2 text-center text-[0.88rem] font-semibold no-underline",
              active === tab.key ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <nav aria-label={t("servicesLabel")} className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[0.74rem] font-bold uppercase tracking-[0.12em] text-ink-3">
          {t("servicesLabel")}
        </span>
        {services.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-3 py-1.5 text-[0.82rem] font-semibold text-ink-2 no-underline hover:border-ink hover:text-ink"
          >
            <Icon name={s.icon} className="size-4 text-primary-ink" />
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
