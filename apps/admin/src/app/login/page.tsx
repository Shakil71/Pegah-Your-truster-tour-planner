import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Logo } from "@pegah/ui";
import hero from "@/assets/images/hero-sundarbans-sunrise.jpg";
import { serverApi } from "@/lib/api-server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const target = safeNext((await searchParams).next);
  // Already signed in? Go straight to the console.
  const api = await serverApi();
  const { response } = await api.GET("/api/v1/staff/auth/session");
  if (response.ok) redirect(target);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
      <section className="relative hidden overflow-hidden bg-night lg:block" aria-hidden="true">
        <Image src={hero} alt="" fill priority sizes="55vw" className="object-cover opacity-80" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgb(10_12_28/0.85))]" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary">
            Pegah operations
          </p>
          <p className="mt-3 max-w-[30ch] font-display text-[2.6rem] font-medium leading-[1.05]">
            Every booking held honestly until it is truly confirmed.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 stitch opacity-70" />
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Logo className="text-[2rem] text-ink" />
          <h1 className="mt-8 font-display text-[2rem] font-medium leading-tight">Staff sign in</h1>
          <p className="mt-2 text-ink-2">
            Use the account an owner created for you. Sessions end after 30 idle minutes.
          </p>
          <LoginForm next={target} />
          <p className="mt-8 text-[0.78rem] text-ink-3">
            Sign-ins are logged. Travellers can return to the{" "}
            {/* The public site lives outside this app's /admin basePath, so <Link> cannot reach it. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="font-semibold text-primary-ink underline">
              Pegah website
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
