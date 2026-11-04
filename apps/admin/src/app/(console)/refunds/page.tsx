import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";
import { MarkPaid } from "./mark-paid";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("payment:read")) {
    return <NoAccess what="refunds" permission="payment:read" />;
  }
  const sp = await searchParams;
  const status = sp.status === "PAID" ? "PAID" : sp.status === "ALL" ? undefined : "PENDING";
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/refunds", { params: { query: { status, limit: 100 } } }),
  );
  const canPay = session.user.permissions.includes("refund:approve");

  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Finance"
        title="Refunds"
        intro="Refunds approved when a cancellation was accepted. Return the money from the payment provider or bank, then record its reference here."
      />
      <section className="panel overflow-hidden" aria-label="Refunds">
        <nav className="flex gap-2 border-b border-rule px-4 py-3 md:px-6" aria-label="Filter">
          {[
            ["PENDING", "To pay"],
            ["PAID", "Paid"],
            ["ALL", "All"],
          ].map(([value, label]) => {
            const active = (status ?? "ALL") === value;
            return (
              <Link
                key={value}
                href={`/refunds?status=${value}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-on-primary"
                    : "rounded-full border border-rule px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 hover:border-ink"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">Nothing here.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {page.items.map((r) => (
              <li
                key={r.id}
                className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:px-6"
              >
                <div>
                  <p className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/bookings/${r.bookingId}`}
                      className="tabular font-semibold hover:underline"
                    >
                      {r.bookingReference}
                    </Link>
                    <span className="text-ink-2">{r.customerName}</span>
                    <span className="tabular font-semibold">{money(r.amount)}</span>
                  </p>
                  <p className="text-[0.82rem] text-ink-2">{r.reason}</p>
                  <p className="text-[0.76rem] text-ink-3">
                    Approved {dhakaDateTime(r.createdAt)}
                    {r.status === "PAID" &&
                      ` · paid ${r.paidAt ? dhakaDateTime(r.paidAt) : ""} · ref ${r.providerRef}`}
                  </p>
                </div>
                {r.status === "PENDING" && canPay && (
                  <MarkPaid refundId={r.id} csrfToken={session.csrfToken} />
                )}
                {r.status === "PENDING" && !canPay && (
                  <p className="self-center text-[0.78rem] text-ink-3">
                    Needs refund:approve to record payment
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
