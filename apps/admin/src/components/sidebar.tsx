"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Logo, cx } from "@pegah/ui";
import { buildInfo } from "@/lib/build-info";
import { navGroups } from "@/lib/nav";

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const path = usePathname();

  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-night text-[#c9cde4] transition-transform duration-300 ease-pegah lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
      aria-label="Admin navigation"
    >
      <div className="flex h-[72px] items-center gap-3 px-6">
        <Link href="/" onClick={onNavigate} className="text-white">
          <Logo className="text-[1.7rem]" />
        </Link>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/70">
          Admin
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]">
        {navGroups.map((g) => (
          <div key={g.title} className="mt-5 first:mt-1">
            <p className="px-3 pb-2 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-white/40">
              {g.title}
            </p>
            <ul className="grid gap-0.5">
              {g.items.map((item) => {
                const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.9rem] font-medium transition-colors",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[linear-gradient(180deg,var(--pg-primary)_0_6px,transparent_6px_10px)] bg-[length:3px_10px]"
                        />
                      )}
                      <Icon
                        name={item.icon}
                        className={cx(
                          "size-[19px]",
                          active ? "text-primary" : "text-white/55 group-hover:text-white/80",
                        )}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="tabular rounded-full bg-primary px-1.5 py-px text-[0.68rem] font-bold text-on-primary">
                          {item.badge}
                        </span>
                      ) : item.phase ? (
                        <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-white/30">
                          {item.phase.replace("Phase ", "P")}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-[14px] border border-dashed border-primary/50 bg-primary/[0.07] p-3.5 text-[0.78rem]">
        <p className="flex items-center gap-2 font-semibold text-white">
          <span className="relative flex size-2">
            <span className="animate-ping-soft absolute inline-flex size-full rounded-full bg-primary" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Sandbox environment
        </p>
        <p className="mt-1 text-white/60">Sample data. The admin API is not connected yet.</p>
        <p className="tabular mt-2 text-[0.72rem] text-white/45">
          Build {buildInfo.sha} · {buildInfo.builtAtLabel}
        </p>
      </div>
    </aside>
  );
}
