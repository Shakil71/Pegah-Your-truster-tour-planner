import type { Metadata } from "next";
import Link from "next/link";
import { Icon, cx } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { REQUEST_STATUS, RequestPill } from "@/components/request-pill";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";
import { RequestStaffActions } from "./staff-actions";

export const metadata: Metadata = { title: "Request" };

const PURPOSE: Record<string, string> = {
  TOURISM: "Tourism",
  BUSINESS: "Business",
  FAMILY: "Visiting family",
  STUDY: "Study",
  MEDICAL: "Medical",
  OTHER: "Other",
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("service:manage")) {
    return <NoAccess what="visa and flight requests" permission="service:manage" />;
  }
  const { id } = await params;
  const api = await serverApi();
  const r = ensure(await api.GET("/api/v1/admin/requests/{id}", { params: { path: { id } } }));

  const facts: Array<[string, string]> = [];
  if (r.visa) {
    facts.push([
      "Visa",
      r.visaProduct ? `${r.visaProduct.country} · ${r.visaProduct.visaType}` : "—",
    ]);
    facts.push(["Travel date", calendarDate(r.visa.travelDate)]);
    facts.push(["Purpose", PURPOSE[r.visa.purpose] ?? r.visa.purpose]);
    facts.push(["Passports", r.visa.nationality]);
  }
  if (r.flight) {
    facts.push(["Route", `${r.flight.from} → ${r.flight.to}`]);
    facts.push(["Trip", r.flight.tripType === "ROUND_TRIP" ? "Round trip" : "One way"]);
    facts.push(["Departure", calendarDate(r.flight.departDate)]);
    if (r.flight.returnDate) facts.push(["Return", calendarDate(r.flight.returnDate)]);
    facts.push([
      "Passengers",
      `${r.flight.adults} adult · ${r.flight.children} child · ${r.flight.infants} infant`,
    ]);
    facts.push(["Cabin", r.flight.cabin.replaceAll("_", " ").toLowerCase()]);
    if (r.flight.preferredAirline) facts.push(["Airline", r.flight.preferredAirline]);
  }
  facts.push(["Travellers", String(r.travellers)]);

  return (
    <div className="mx-auto grid max-w-[1280px] gap-6">
      <Link
        href="/requests"
        className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 hover:text-ink"
      >
        <Icon name="arrowLeft" className="size-4" /> All requests
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="tabular text-[0.8rem] text-ink-3">
            {r.reference} · {r.kind === "VISA" ? "Visa application" : "Flight request"}
          </p>
          <h1 className="font-display text-[clamp(1.8rem,3vw,2.4rem)] font-medium leading-tight">
            {r.title}
          </h1>
        </div>
        <RequestPill status={r.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <RequestStaffActions
            id={r.id}
            status={r.status}
            paid={!!r.paidAt}
            csrfToken={session.csrfToken}
          />

          <section className="panel p-5 md:p-6" aria-labelledby="tl-h">
            <h2 id="tl-h" className="text-[0.95rem] font-semibold">
              History
            </h2>
            <ol className="mt-3 grid gap-3">
              {[...r.staffEvents].reverse().map((e, i) => (
                <li
                  key={i}
                  className={cx("border-l-2 pl-3", e.internal ? "border-warn" : "border-rule")}
                >
                  <p className="text-[0.76rem] text-ink-3">
                    {e.actor === "CUSTOMER"
                      ? "Customer"
                      : e.actor === "SYSTEM"
                        ? "System"
                        : (e.actorName ?? "Staff")}{" "}
                    · {dhakaDateTime(e.at)}
                    {e.toStatus && (
                      <>
                        {" "}
                        ·{" "}
                        <strong className="text-ink-2">
                          {REQUEST_STATUS[e.toStatus]?.label ?? e.toStatus}
                        </strong>
                      </>
                    )}
                    {e.internal && (
                      <>
                        {" "}
                        · <strong className="text-warn">internal note</strong>
                      </>
                    )}
                  </p>
                  {e.message && (
                    <p className="mt-0.5 whitespace-pre-line text-[0.9rem]">{e.message}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <section className="panel p-5 md:p-6" aria-labelledby="cust-h">
            <h2 id="cust-h" className="text-[0.95rem] font-semibold">
              Customer
            </h2>
            <p className="mt-2 font-semibold">{r.contactName}</p>
            <p className="tabular text-[0.88rem]">
              <a href={`tel:${r.contactPhone}`} className="text-primary-ink">
                {r.contactPhone}
              </a>
            </p>
            <p className="text-[0.88rem]">
              <a href={`mailto:${r.contactEmail}`} className="text-primary-ink">
                {r.contactEmail}
              </a>
            </p>
            <p className="mt-1 text-[0.76rem] text-ink-3">
              Account: {r.customer.name} · {r.customer.email}
            </p>
          </section>
          <section className="panel p-5 md:p-6" aria-labelledby="det-h">
            <h2 id="det-h" className="text-[0.95rem] font-semibold">
              Details
            </h2>
            <dl className="mt-3 grid gap-2 text-[0.88rem]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {r.note && (
              <p className="mt-3 whitespace-pre-line rounded-[10px] bg-paper-2 px-3 py-2 text-[0.86rem]">
                {r.note}
              </p>
            )}
          </section>
          <section className="panel p-5 md:p-6" aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-[0.95rem] font-semibold">
              Price and payment
            </h2>
            <dl className="mt-3 grid gap-2 text-[0.88rem]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Quote</dt>
                <dd className="tabular font-semibold">{r.quote ? money(r.quote) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Quoted</dt>
                <dd>{r.quotedAt ? dhakaDateTime(r.quotedAt) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Paid</dt>
                <dd>{r.paidAt ? dhakaDateTime(r.paidAt) : "—"}</dd>
              </div>
              {r.paidOffline && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Reference</dt>
                  <dd className="tabular">{r.paidOffline}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="panel p-5 md:p-6" aria-labelledby="doc-h">
            <h2 id="doc-h" className="text-[0.95rem] font-semibold">
              Documents ({r.documents.length})
            </h2>
            {r.visaProduct && (
              <details className="mt-2 text-[0.82rem] text-ink-2">
                <summary className="cursor-pointer font-semibold">Required for this visa</summary>
                <ul className="mt-1 list-disc pl-5">
                  {r.visaProduct.requirements.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </details>
            )}
            {r.documentsPurged ? (
              <p className="mt-2 text-[0.86rem] text-ink-2">Deleted after the retention period.</p>
            ) : r.documents.length === 0 ? (
              <p className="mt-2 text-[0.86rem] text-ink-2">None uploaded yet.</p>
            ) : (
              <ul className="mt-2 grid gap-2 text-[0.86rem]">
                {r.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span>
                      <strong>{d.label}</strong>
                      <span className="block text-[0.76rem] text-ink-3">
                        {d.fileName} · {Math.ceil(d.byteSize / 1024)} KB ·{" "}
                        {d.uploadedByStaff ? "staff" : "customer"} · {dhakaDateTime(d.createdAt)}
                      </span>
                    </span>
                    <a
                      href={`/api/v1/admin/requests/${r.id}/documents/${d.id}`}
                      className="inline-flex items-center gap-1 text-[0.82rem] font-semibold text-primary-ink"
                    >
                      <Icon name="download" className="size-4" /> Open
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[0.74rem] text-ink-3">
              {r.uploadsEnabled
                ? "Encrypted at rest. Opening a document is recorded in the audit log."
                : "Uploads are off: DOCUMENT_ENCRYPTION_KEY is not set on the server."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
