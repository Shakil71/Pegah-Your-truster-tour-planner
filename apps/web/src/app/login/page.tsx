import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import hero from "@/assets/images/srimangal-tea.jpg";
import { PageShell } from "@/components/shop/page-shell";
import { getCustomer } from "@/lib/api-server";
import { AuthForm } from "./auth-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signIn"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account/bookings";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("auth");
  const next = safeNext(sp.next);
  if (await getCustomer()) redirect(next);

  return (
    <PageShell>
      <div className="panel grid overflow-hidden lg:grid-cols-2">
        <div className="relative hidden min-h-[560px] lg:block" aria-hidden="true">
          <Image src={hero} alt="" fill priority sizes="640px" className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgb(10_12_28/0.8))]" />
          <p className="absolute inset-x-0 bottom-0 p-10 font-display text-[2.2rem] font-medium leading-[1.05] text-white">
            {t("panelLine")}
          </p>
        </div>
        <div className="p-6 md:p-10">
          <AuthForm next={next} initialMode={sp.mode === "register" ? "register" : "login"} />
        </div>
      </div>
    </PageShell>
  );
}
