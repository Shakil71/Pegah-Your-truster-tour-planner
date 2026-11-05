import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNotice } from "@/components/site-notice";

/** Inner pages: solid header, content offset below it, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader solid />
      <main className="min-h-dvh bg-paper px-[max(16px,env(safe-area-inset-left,0px))] pb-20 pt-[104px]">
        <div className="mx-auto max-w-[1280px]">
          <SiteNotice className="mb-6" />
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Honest booking notice shown wherever a booking could be made. True whether payment is live or not. */
export function PaymentNotice() {
  const t = useTranslations("shop");
  return (
    <p className="rounded-[14px] border border-dashed border-primary/60 bg-primary-soft px-4 py-3 text-[0.86rem] text-ink">
      {t.rich("paymentNotice", { b: (chunks) => <b>{chunks}</b> })}
    </p>
  );
}
