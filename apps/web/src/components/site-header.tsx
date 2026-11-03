"use client";

import Link from "next/link";
import { Icon, Logo, cx } from "@pegah/ui";
import { useScrolledPast } from "@/lib/use-browser";

const nav = [
  { href: "#stays", label: "Stays" },
  { href: "#tours", label: "Tours" },
  { href: "#explore", label: "Destinations" },
];

/** Transparent over the hero photo, solid once the page scrolls. */
export function SiteHeader() {
  const solid = useScrolledPast(40);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50 px-[max(16px,env(safe-area-inset-left,0px))] transition-[background-color,color,box-shadow] duration-300",
        solid ? "bg-card text-ink shadow-[0_1px_0_var(--pg-rule)]" : "text-white",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-8">
        <Link href="/" aria-label="Pegah home" className="no-underline">
          <Logo className="text-[1.8rem]" />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex gap-6 text-[0.94rem] font-medium">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="border-b-2 border-transparent py-1.5 hover:border-current"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <span className="py-1.5 opacity-80">
                Flights<sup className="ml-1 text-[0.58rem] uppercase tracking-wider">soon</sup>
              </span>
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="tabular hidden md:inline">৳ BDT · EN</span>
          <button
            type="button"
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current px-4 py-[7px] font-semibold transition-colors",
              solid ? "hover:bg-ink hover:text-card" : "hover:bg-white hover:text-night",
            )}
          >
            <Icon name="user" className="size-4" />
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}
