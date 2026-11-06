import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Icon, cx } from "@pegah/ui";
import { PageShell } from "@/components/shop/page-shell";
import type { Locale } from "@/i18n/locales";
import { requireCustomer, serverApi } from "@/lib/api-server";
import { calendarDate, dhakaDateTime, money } from "@/lib/format";
import { REQUEST_STATUS_TONE } from "@/lib/request-status";
import { RequestActions } from "./request-actions";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getTranslations("services"))("requestsHeading"),
    robots: { index: false },
  };
}
export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomer(`/account/requests/${id}`);
  const t = await getTranslations("services");
  const locale = (await getLocale()) as Locale;
  const api = await serverApi();
  const { data: r, response } = await api.GET("/api/v1/me/requests/{id}", {
    params: { path: { id } },
  });
  if (response.status === 404 || !r) notFound();

  const facts: Array<[string, string]> = [];
  if (r.visa) {
    facts.push([t("travelDate"), calendarDate(r.visa.travelDate, locale)]);
    facts.push([t("purpose"), t(`purpose_${r.visa.purpose}`)]);
    facts.push([t("nationality"), r.visa.nationality]);
  }
  if (r.flight) {
    facts.push([
      t(r.flight.tripType === "ROUND_TRIP" ? "roundTrip" : "oneWay"),
      t("tripLine", { from: r.flight.from, to: r.flight.to }),
    ]);
    facts.push([t("departDate"), calendarDate(r.flight.departDate, locale)]);
    if (r.flight.returnDate)
      facts.push([t("returnDate"), calendarDate(r.flight.returnDate, locale)]);
    facts.push([t("cabin"), t(`cabin_${r.flight.cabin}`)]);
    facts.push([
      t("travellers"),
      `${r.flight.adults} · ${r.flight.children} · ${r.flight.infants}`,
    ]);
    if (r.flight.preferredAirline) facts.push([t("preferredAirline"), r.flight.preferredAirline]);
  }
  facts.push([t("travellers"), t("people", { count: r.travellers })]);

  return (
    <PageShell>
      <div className="grid gap-6">
        <Link
          href="/account/requests"
          className="inline-flex items-center gap-1 text-[0.86rem] font-semibold text-ink-2 no-underline hover:text-ink"
        >
          <Icon name="arrowLeft" className="size-4" /> {t("back")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="tabular text-[0.8rem] text-ink-3">{r.reference}</p>
            <h1 className="font-display text-[clamp(1.8rem,3.2vw,2.6rem)] font-medium leading-tight">
              {r.title}
            </h1>
          </div>
          <span
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[0.86rem] font-semibold",
              REQUEST_STATUS_TONE[r.status],
            )}
          >
            {t(`status_${r.status}`)}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <section className="panel p-5 md:p-6" aria-labelledby="price-h">
              <h2 id="price-h" className="text-[1rem] font-semibold">
                {t("price")}
              </h2>
              {r.quote ? (
                <>
                  <p className="tabular mt-2 font-display text-[2rem] font-medium">
                    {money(r.quote)}
                  </p>
                  {r.quoteNote && (
                    <p className="mt-1 whitespace-pre-line text-[0.9rem] text-ink-2">
                      {r.quoteNote}
                    </p>
                  )}
                  {r.paidAt ? (
                    <p className="mt-3 rounded-[10px] bg-good-soft px-3 py-2 text-[0.88rem] text-good">
                      {t("paidOn", { date: dhakaDateTime(r.paidAt, locale) })}
                    </p>
                  ) : (
                    r.status === "QUOTED" && (
                      <p className="mt-3 text-[0.88rem] text-ink-2">{t("payHow")}</p>
                    )
                  )}
                </>
              ) : (
                <p className="mt-2 text-[0.9rem] text-ink-2">{t("priceWaiting")}</p>
              )}
            </section>

            <section className="panel p-5 md:p-6" aria-labelledby="tl-h">
              <h2 id="tl-h" className="text-[1rem] font-semibold">
                {t("timeline")}
              </h2>
              <ol className="mt-3 grid gap-3">
                {[...r.events].reverse().map((e, i) => (
                  <li key={i} className="border-l-2 border-rule pl-3">
                    <p className="text-[0.78rem] text-ink-3">
                      {e.actor === "CUSTOMER"
                        ? t("you")
                        : e.actor === "STAFF"
                          ? t("pegah")
                          : t("system")}{" "}
                      · {dhakaDateTime(e.at, locale)}
                      {e.toStatus && (
                        <>
                          {" "}
                          · <strong className="text-ink-2">{t(`status_${e.toStatus}`)}</strong>
                        </>
                      )}
                    </p>
                    {e.message && (
                      <p className="mt-0.5 whitespace-pre-line text-[0.92rem]">{e.message}</p>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <RequestActions
              requestId={r.id}
              csrfToken={session.csrfToken}
              canReply={r.canReply}
              canCancel={r.canCancel}
              canUpload={r.canUpload}
              uploadsEnabled={r.uploadsEnabled}
              closed={["COMPLETED", "REJECTED", "CANCELLED"].includes(r.status)}
            />
          </div>

          <aside className="grid content-start gap-4">
            <section className="panel p-5 md:p-6" aria-labelledby="det-h">
              <h2 id="det-h" className="text-[1rem] font-semibold">
                {t("details")}
              </h2>
              <dl className="mt-3 grid gap-2 text-[0.9rem]">
                {facts.map(([k, v]) => (
                  <div key={k + v} className="flex justify-between gap-4">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.note && (
                <p className="mt-3 whitespace-pre-line text-[0.86rem] text-ink-2">{r.note}</p>
              )}
            </section>

            {r.visaProduct && (
              <section className="panel p-5 md:p-6" aria-labelledby="need-h">
                <h2 id="need-h" className="text-[1rem] font-semibold">
                  {t("documentsNeeded")}
                </h2>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-[0.88rem] text-ink-2">
                  {r.visaProduct.requirements.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="panel p-5 md:p-6" aria-labelledby="doc-h">
              <h2 id="doc-h" className="text-[1rem] font-semibold">
                {t("documents")}
              </h2>
              {r.documentsPurged ? (
                <p className="mt-2 text-[0.88rem] text-ink-2">{t("documentsPurged")}</p>
              ) : r.documents.length === 0 ? (
                <p className="mt-2 text-[0.88rem] text-ink-2">{t("noDocuments")}</p>
              ) : (
                <ul className="mt-2 grid gap-2 text-[0.88rem]">
                  {r.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <span>
                        <strong>{d.label}</strong>
                        <span className="block text-[0.78rem] text-ink-3">
                          {d.fileName} · {Math.ceil(d.byteSize / 1024)} KB
                          {d.uploadedByStaff ? ` · ${t("addedBy")}` : ""}
                        </span>
                      </span>
                      <a
                        href={`/api/v1/me/requests/${r.id}/documents/${d.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-primary-ink"
                      >
                        <Icon name="download" className="size-4" />
                        <span className="sr-only">{d.fileName}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex items-start gap-1.5 text-[0.78rem] text-ink-3">
                <Icon name="shield" className="mt-0.5 size-4 shrink-0" /> {t("secureNote")}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
