import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingsTable } from "@/components/bookings-table";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { AccountControls } from "./account-controls";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  if (!session.user.permissions.includes("customer:read")) {
    return <NoAccess what="customers" permission="customer:read" />;
  }
  const api = await serverApi();
  const { data: c, response } = await api.GET("/api/v1/admin/customers/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !c) notFound();
  const active = c.bookings.filter((b) =>
    [
      "PENDING_PAYMENT",
      "PAYMENT_PROCESSING",
      "CONFIRMED",
      "MANUAL_REVIEW",
      "CANCELLATION_REQUESTED",
    ].includes(b.status),
  ).length;

  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Customer"
        title={c.fullName}
        intro={
          <>
            <a href={`mailto:${c.email}`} className="hover:underline">
              {c.email}
            </a>
            {c.emailVerified ? " (confirmed)" : " (not confirmed yet)"}
            {c.phone && (
              <>
                {" · "}
                <a href={`tel:${c.phone}`} className="tabular hover:underline">
                  {c.phone}
                </a>
              </>
            )}
            {c.status === "DISABLED" && (
              <span className="ml-2 font-semibold text-critical">· disabled</span>
            )}
          </>
        }
        back={{ href: "/customers", label: "All customers" }}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Bookings", String(c.bookingCount)],
          ["Active now", String(active)],
          ["Confirmed spend", money(c.lifetimeValue)],
          ["Customer since", dhakaDateTime(c.createdAt)],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-[0.78rem] font-semibold text-ink-2">{label}</p>
            <p className="tabular mt-1 font-display text-[1.6rem] font-medium leading-tight">
              {value}
            </p>
          </div>
        ))}
      </div>
      {session.user.permissions.includes("customer:manage") && (
        <AccountControls customerId={c.id} status={c.status} csrfToken={session.csrfToken} />
      )}
      <section className="panel overflow-hidden" aria-labelledby="cust-bookings-h">
        <div className="flex items-center justify-between px-5 pt-5 md:px-6">
          <h2 id="cust-bookings-h" className="text-[0.95rem] font-semibold">
            Bookings
          </h2>
          {c.bookingCount > c.bookings.length && (
            <Link
              href={`/bookings?customerId=${c.id}`}
              className="text-[0.82rem] font-semibold text-primary-ink hover:underline"
            >
              See all {c.bookingCount}
            </Link>
          )}
        </div>
        <div className="mt-3">
          <BookingsTable rows={c.bookings} caption={`Bookings of ${c.fullName}`} />
        </div>
      </section>
    </div>
  );
}
