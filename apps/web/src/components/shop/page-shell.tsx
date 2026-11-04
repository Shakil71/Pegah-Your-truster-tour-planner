import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Inner pages: solid header, content offset below it, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader solid />
      <main className="min-h-dvh bg-paper px-[max(16px,env(safe-area-inset-left,0px))] pb-20 pt-[104px]">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Honest pre-launch notice shown wherever a booking could be made. */
export function PaymentNotice() {
  return (
    <p className="rounded-[14px] border border-dashed border-primary/60 bg-primary-soft px-4 py-3 text-[0.86rem] text-ink">
      <b>Pre-launch:</b> you can hold a room or seat for 15 minutes, but online payment opens in the
      next release. A held booking is <b>not confirmed</b> and is released automatically if unpaid.
    </p>
  );
}
