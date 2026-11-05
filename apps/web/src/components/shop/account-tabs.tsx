import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@pegah/ui";

/** Account sub-navigation shared by My trips and Profile. */
export function AccountTabs({ active }: { active: "trips" | "profile" }) {
  const t = useTranslations("account");
  const tabs = [
    { key: "trips", href: "/account/bookings", label: t("myTrips") },
    { key: "profile", href: "/account/profile", label: t("profileTab") },
  ] as const;
  return (
    <nav
      aria-label={t("label")}
      className="flex gap-1 rounded-full border border-rule bg-card p-1 sm:w-fit"
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
  );
}
