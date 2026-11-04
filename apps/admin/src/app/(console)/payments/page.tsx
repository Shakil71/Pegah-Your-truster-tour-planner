import type { Metadata } from "next";
import Link from "next/link";
import { PAYMENT_STATUSES, type PaymentStatus } from "@pegah/contracts";
import { Icon } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PaymentPill } from "@/components/payment-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime, money } from "@/lib/format";

export const metadata: Metadata = { title: "Payments" };

type Search = { status?: string; cursor?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("payment:read")) {
    return <NoAccess what="payments" permission="payment:read" />;
  }
  const sp = await searchParams;
  const status = PAYMENT_STATUSES.includes(sp.status as PaymentStatus)
    ? (sp.status as PaymentStatus)
    : undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/payments", {
      params: { query: { status, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 50 } },
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div className="animate-rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          Finance
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Payments
        </h1>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Every hosted-payment attempt. A payment counts only after the provider confirmed it
          server-to-server. <b>Refund required</b> means money arrived for a booking that could not
          be confirmed: refund it from the provider panel.
        </p>
      </div>

      <section className="panel overflow-hidden" aria-label="Payments">
        <nav
          className="flex flex-wrap gap-2 border-b border-rule px-4 py-3 md:px-6"
          aria-label="Filter"
        >
          {[undefined, ...PAYMENT_STATUSES].map((s) => (
            <Link
              key={s ?? "ALL"}
              href={s ? `/payments?status=${s}` : "/payments"}
              aria-current={status === s ? "page" : undefined}
              className={
                status === s
                  ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-on-primary"
                  : "rounded-full border border-rule px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 hover:border-ink hover:text-ink"
              }
            >
              {s ? s.replaceAll("_", " ").toLowerCase() : "All"}
            </Link>
          ))}
        </nav>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">
            No payments yet. Online payment is switched on with PAYMENT_PROVIDER (see
            docs/operations/SSLCOMMERZ_INTEGRATION.md).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[0.84rem]">
              <caption className="sr-only">Payments, newest first</caption>
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Started (Dhaka)
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Booking
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Provider
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((p) => (
                  <tr key={p.id} className="border-t border-rule align-top">
                    <td className="tabular whitespace-nowrap px-4 py-3">
                      {dhakaDateTime(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bookings/${p.bookingId}`}
                        className="tabular font-semibold hover:underline"
                      >
                        {p.bookingReference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.provider}
                      {p.method && <p className="text-[0.74rem] text-ink-3">{p.method}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentPill status={p.status} />
                      {p.failureReason && (
                        <p className="mt-1 max-w-[260px] text-[0.74rem] text-ink-3">
                          {p.failureReason}
                        </p>
                      )}
                      {p.riskLevel ? (
                        <p className="mt-1 text-[0.74rem] font-semibold text-critical">
                          Risk flag {p.riskLevel}
                        </p>
                      ) : null}
                    </td>
                    <td className="tabular px-4 py-3 text-[0.76rem] text-ink-2">
                      <p>{p.providerTxnId}</p>
                      {p.bankTxnId && <p className="text-ink-3">bank {p.bankTxnId}</p>}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {money(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.nextCursor && (
          <div className="flex justify-end border-t border-rule px-4 py-3 text-[0.8rem] md:px-6">
            <Link
              href={`/payments?${new URLSearchParams({ ...(status ? { status } : {}), cursor: page.nextCursor })}`}
              className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
            >
              Older payments <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
