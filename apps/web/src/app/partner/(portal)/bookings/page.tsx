import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@pegah/ui";
import { PartnerBookingTable } from "@/components/partner/booking-table";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner"))("nav.clientBookings") };
}

/** Bookings the agent made for clients, with the commission on each. */
export default async function AgentBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requirePartner("AGENT");
  const t = await getTranslations("partner");
  const { cursor } = await searchParams;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/partner/bookings", {
      params: { query: { limit: 30, cursor: cursor?.slice(0, 200) || undefined } },
    }),
  );
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {t("nav.clientBookings")}
          </h1>
          <p className="mt-1 text-[0.9rem] text-ink-2">{t("bookings.intro")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/stays" className={buttonClass("primary", "md", "no-underline")}>
            {t("bookings.bookStay")}
          </Link>
          <Link href="/tours" className={buttonClass("outline", "md", "no-underline")}>
            {t("bookings.bookTour")}
          </Link>
        </div>
      </div>
      <PartnerBookingTable
        items={page.items}
        showCommission
        linkTo={(id) => `/partner/bookings/${id}`}
      />
      {page.nextCursor && (
        <Link
          href={`/partner/bookings?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="justify-self-start font-semibold text-primary-ink"
        >
          {t("bookings.older")}
        </Link>
      )}
    </div>
  );
}
