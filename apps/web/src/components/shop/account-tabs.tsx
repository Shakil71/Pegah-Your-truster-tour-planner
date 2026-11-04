import Link from "next/link";
import { cx } from "@pegah/ui";

/** Account sub-navigation shared by My trips and Profile. */
export function AccountTabs({ active }: { active: "trips" | "profile" }) {
  const tabs = [
    { key: "trips", href: "/account/bookings", label: "My trips" },
    { key: "profile", href: "/account/profile", label: "Profile and travellers" },
  ] as const;
  return (
    <nav
      aria-label="Account"
      className="flex gap-1 rounded-full border border-rule bg-card p-1 sm:w-fit"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cx(
            "flex-1 rounded-full px-4 py-2 text-center text-[0.88rem] font-semibold no-underline",
            active === t.key ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
