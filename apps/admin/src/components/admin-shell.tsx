"use client";

import { useState, type ReactNode } from "react";
import { Icon, cx } from "@pegah/ui";
import { Sidebar } from "./sidebar";

export function AdminShell({ children, today }: { children: ReactNode; today: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cx(
          "fixed inset-0 z-30 bg-night/50 backdrop-blur-[2px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-rule bg-paper/85 backdrop-blur-md">
          <div className="flex h-[72px] items-center gap-4 px-4 md:px-8">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-control border border-rule lg:hidden"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <label className="relative hidden max-w-[420px] flex-1 md:block">
              <span className="sr-only">Search bookings, guests, properties</span>
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3"
              />
              <input
                type="search"
                placeholder="Search bookings, guests, properties"
                className="h-11 w-full rounded-control border border-rule bg-card pl-11 pr-16 text-[0.9rem] outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-rule px-1.5 py-0.5 text-[0.7rem] text-ink-3">
                Ctrl K
              </kbd>
            </label>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[0.84rem] text-ink-2 sm:inline">{today} · Dhaka</span>
              <button
                type="button"
                aria-label="Notifications, 3 unread"
                className="relative grid size-11 place-items-center rounded-full border border-rule bg-card hover:border-ink"
              >
                <Icon name="bell" />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary ring-2 ring-card" />
              </button>
              <div className="flex items-center gap-2.5 rounded-full border border-rule bg-card py-1 pl-1 pr-3.5">
                <span className="grid size-9 place-items-center rounded-full bg-[conic-gradient(from_200deg,var(--pg-primary),#ffb07a,var(--pg-primary))] font-display text-[0.95rem] font-semibold text-on-primary">
                  S
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[0.84rem] font-semibold">Shakil</span>
                  <span className="block text-[0.7rem] text-ink-3">Owner</span>
                </span>
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 pb-16 pt-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
