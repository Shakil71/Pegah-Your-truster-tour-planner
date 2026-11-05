"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, cx } from "@pegah/ui";
import { browserApi, csrf } from "@/lib/api-browser";
import { Sidebar } from "./sidebar";
import { useStaff } from "./staff-context";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Administrator",
  operations: "Operations",
  finance: "Finance",
  content: "Content",
  support: "Support",
};

export function AdminShell({ children, today }: { children: ReactNode; today: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const { user, csrfToken } = useStaff();
  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    setSigningOut(true);
    await browserApi.POST("/api/v1/staff/auth/logout", { headers: csrf(csrfToken) });
    router.replace("/login");
    router.refresh();
  }

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
            <form
              action="/admin/bookings"
              role="search"
              className="relative hidden max-w-[420px] flex-1 md:block"
            >
              <label htmlFor="global-search" className="sr-only">
                Search bookings by reference, guest name or email
              </label>
              <Icon
                name="search"
                className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-3"
              />
              <input
                id="global-search"
                type="search"
                name="q"
                maxLength={80}
                placeholder="Reference, guest name or email"
                className="h-11 w-full rounded-control border border-rule bg-card pl-11 pr-4 text-[0.9rem] outline-none transition-colors placeholder:text-ink-3 focus:border-ink"
              />
            </form>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[0.84rem] text-ink-2 sm:inline">{today} · Dhaka</span>
              <Link
                href="/account"
                title="My account"
                className="flex items-center gap-2.5 rounded-full border border-rule bg-card py-1 pl-1 pr-3.5 hover:border-ink"
              >
                <span className="sr-only">My account: </span>
                <span
                  aria-hidden="true"
                  className="grid size-9 place-items-center rounded-full bg-primary font-display text-[0.95rem] font-semibold text-on-primary"
                >
                  {initials}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="block text-[0.84rem] font-semibold">{user.fullName}</span>
                  <span className="block text-[0.7rem] text-ink-3">
                    {user.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="h-11 rounded-full border border-rule bg-card px-4 text-[0.84rem] font-semibold hover:border-ink disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 pb-16 pt-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
