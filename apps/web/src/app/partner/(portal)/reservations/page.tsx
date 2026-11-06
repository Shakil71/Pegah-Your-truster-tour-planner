import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PartnerBookingTable } from "@/components/partner/booking-table";
import { ensure, requirePartner, serverApi } from "@/lib/api-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partner"))("nav.reservations") };
}

/** Bookings at the supplier's own hotels and on its tours, newest first. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  await requirePartner("SUPPLIER");
  const t = await getTranslations("partner");
  const { cursor } = await searchParams;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/partner/reservations", {
      params: { query: { limit: 30, cursor: cursor?.slice(0, 200) || undefined } },
    }),
  );
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          {t("nav.reservations")}
        </h1>
        <p className="mt-1 text-[0.9rem] text-ink-2">{t("reservations.intro")}</p>
      </div>
      <PartnerBookingTable items={page.items} showCommission={false} />
      {page.nextCursor && (
        <Link
          href={`/partner/reservations?cursor=${encodeURIComponent(page.nextCursor)}`}
          className="justify-self-start font-semibold text-primary-ink"
        >
          {t("reservations.older")}
        </Link>
      )}
    </div>
  );
}
