import Link from "next/link";
import { PageShell } from "@/components/shop/page-shell";

export default function PageNotWritten() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[620px] py-10 text-center">
        <h1 className="font-display text-[2rem] font-medium">This page is being written</h1>
        <p className="mt-2 text-ink-2">
          We are preparing it now. For anything urgent about a booking, open it from your account.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-[0.95rem] font-semibold">
          <Link href="/account/bookings" className="text-primary-ink">
            My trips
          </Link>
          <Link href="/" className="text-primary-ink">
            Home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
