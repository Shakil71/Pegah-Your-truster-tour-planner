import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@pegah/ui";
import { PaymentPill } from "@/components/payment-pill";
import { StatusPill, statusMeta } from "@/components/status-pill";
import { requireStaff, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";
import { StatusChangeForm } from "./status-change-form";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireStaff();
  const api = await serverApi();
  const { data: b, response } = await api.GET("/api/v1/admin/bookings/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !b) notFound();
  const canChange = session.user.permissions.includes("booking:override_status");

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6">
      <div className="animate-rise">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1 text-[0.84rem] font-semibold text-ink-2 hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> All bookings
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="tabular font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
            {b.reference}
          </h1>
          <StatusPill status={b.status} />
        </div>
        <p className="mt-1 text-ink-2">
          {b.productName} · {b.productType === "HOTEL" ? "Stay" : "Tour"} · created{" "}
          {dhakaDateTime(b.createdAt)}
        </p>
        {b.holdExpiresAt && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-warn-soft px-3 py-1.5 text-[0.82rem] font-semibold text-warn">
            <Icon name="clock" className="size-4" />
            Inventory held until {dhakaDateTime(b.holdExpiresAt)} (Dhaka). It is released
            automatically if unpaid.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section className="panel p-5 md:p-6" aria-labelledby="trip-h">
            <h2 id="trip-h" className="text-[0.95rem] font-semibold">
              Trip
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">
                  {b.productType === "HOTEL" ? "Check-in" : "Departs"}
                </dt>
                <dd className="tabular mt-1 font-semibold">{calendarDate(b.startDate)}</dd>
              </div>
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">
                  {b.productType === "HOTEL" ? "Check-out" : "Returns"}
                </dt>
                <dd className="tabular mt-1 font-semibold">
                  {b.endDate ? calendarDate(b.endDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">Guests</dt>
                <dd className="tabular mt-1 font-semibold">{b.guests}</dd>
              </div>
            </dl>
            <ul className="mt-5 grid gap-2 border-t border-rule pt-4">
              {b.items.map((item) => (
                <li key={item.description} className="flex justify-between gap-4 text-[0.9rem]">
                  <span>{item.description}</span>
                  <span className="tabular font-semibold">{money(item.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5 md:p-6" aria-labelledby="trav-h">
            <h2 id="trav-h" className="text-[0.95rem] font-semibold">
              Travellers and contact
            </h2>
            <ul className="mt-4 grid gap-2">
              {b.travellers.map((t, i) => (
                <li key={`${t.fullName}-${i}`} className="flex items-center gap-2 text-[0.9rem]">
                  <Icon name="user" className="size-4 text-ink-3" />
                  {t.fullName}
                  <span className="text-[0.76rem] text-ink-3">
                    {t.ageGroup === "CHILD" ? "child" : "adult"}
                    {t.isLead && " · lead guest"}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 grid gap-3 border-t border-rule pt-4 text-[0.9rem] sm:grid-cols-3">
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">Contact</dt>
                <dd className="mt-1">{b.contactName}</dd>
              </div>
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">Email</dt>
                <dd className="mt-1 break-all">
                  <a href={`mailto:${b.contactEmail}`} className="hover:underline">
                    {b.contactEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.74rem] uppercase tracking-[0.08em] text-ink-3">Phone</dt>
                <dd className="tabular mt-1">
                  <a href={`tel:${b.contactPhone}`} className="hover:underline">
                    {b.contactPhone}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel p-5 md:p-6" aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-[0.95rem] font-semibold">
              Status history
            </h2>
            <ol className="mt-4 grid gap-4">
              {b.history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <StatusPill status={h.to} />
                  <div className="text-[0.86rem]">
                    <p>
                      {h.from ? `${statusMeta[h.from].label} → ` : ""}
                      {statusMeta[h.to].label}
                      <span className="text-ink-3">
                        {" "}
                        · {h.actorType.toLowerCase().replace("_", " ")} · {dhakaDateTime(h.at)}
                      </span>
                    </p>
                    {h.reason && <p className="mt-0.5 text-ink-2">{h.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section className="panel p-5 md:p-6" aria-labelledby="price-h">
            <h2 id="price-h" className="text-[0.95rem] font-semibold">
              Price (computed by the server)
            </h2>
            <dl className="tabular mt-4 grid gap-2 text-[0.9rem]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Base</dt>
                <dd>{money(b.price.base)}</dd>
              </div>
              {b.price.serviceCharge.amountMinor > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Service charge</dt>
                  <dd>{money(b.price.serviceCharge)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">VAT</dt>
                <dd>{money(b.price.vat)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-rule pt-3 text-[1.05rem] font-bold">
                <dt>Total</dt>
                <dd>{money(b.price.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel p-5 md:p-6" aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-[0.95rem] font-semibold">
              Payments
            </h2>
            {b.payments.length === 0 ? (
              <p className="mt-2 text-[0.86rem] text-ink-2">No payment attempts yet.</p>
            ) : (
              <ul className="mt-3 grid gap-3">
                {b.payments.map((p) => (
                  <li key={p.id} className="grid gap-1 text-[0.86rem]">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <PaymentPill status={p.status} />
                      <span className="tabular font-semibold">{money(p.amount)}</span>
                    </span>
                    <span className="text-[0.76rem] text-ink-3">
                      {p.provider}
                      {p.method ? ` · ${p.method}` : ""} · {dhakaDateTime(p.createdAt)}
                    </span>
                    {p.failureReason && (
                      <span className="text-[0.78rem] text-ink-2">{p.failureReason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canChange && (
            <StatusChangeForm
              bookingId={b.id}
              current={b.status}
              allowed={b.allowedTransitions}
              csrfToken={session.csrfToken}
            />
          )}
        </div>
      </div>
    </div>
  );
}
