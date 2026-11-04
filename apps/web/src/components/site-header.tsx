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
      {/* Three columns so the menu sits in the true centre, whatever the widths of the logo and actions. */}
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[1fr_auto] items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <Link href="/" aria-label="Pegah home" className="no-underline">
            <Logo className="text-[1.8rem]" />
          </Link>
        </div>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex gap-8 text-[0.94rem] font-medium">
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
        <div className="flex items-center gap-4 justify-self-end text-sm">
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
