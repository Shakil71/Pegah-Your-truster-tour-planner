import { getTranslations } from "next-intl/server";
import { Icon, cx } from "@pegah/ui";
import type { OfferItem, OfferSection, SectionKind } from "@/lib/offer-details";

type IconName = Parameters<typeof Icon>[0]["name"];

const ICON: Record<SectionKind, IconName> = {
  included: "check",
  hotels: "building",
  requirements: "doc",
  policy: "wallet",
  contact: "chat",
  other: "tag",
};

/** Consecutive items of the same kind, so points become one list and rows one table. */
function runs(items: OfferItem[]) {
  const out: Array<{ type: OfferItem["type"]; items: OfferItem[] }> = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.type === item.type && item.type !== "sub") last.items.push(item);
    else out.push({ type: item.type, items: [item] });
  }
  return out;
}

function Points({ items, columns }: { items: OfferItem[]; columns: boolean }) {
  return (
    <ul
      className={cx(
        "grid gap-x-6 gap-y-2.5 text-[0.93rem] leading-snug text-ink-2",
        columns && "md:grid-cols-2",
      )}
    >
      {items.map((p, i) =>
        p.type === "point" ? (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-[1px] grid size-5 shrink-0 place-items-center rounded-full bg-good-soft text-good">
              <Icon name="check" className="size-3.5" />
            </span>
            <span className="min-w-0">{p.text}</span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

function Rows({ items }: { items: OfferItem[] }) {
  return (
    <dl className="grid gap-2.5 text-[0.93rem]">
      {items.map((r, i) =>
        r.type === "row" ? (
          <div key={i} className="grid gap-0.5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
            <dt className="font-semibold text-ink">{r.label}</dt>
            <dd className="text-ink-2">{r.value}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

/** Hotels: one tile per city ("Makkah Hotel" → Rehab Al Bustan …). */
function HotelTiles({ items }: { items: OfferItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) =>
        item.type === "row" ? (
          <div key={i} className="rounded-[12px] border border-rule bg-paper-2/60 p-4">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-primary-ink">
              {item.label}
            </p>
            <p className="mt-1 text-[0.95rem] font-medium text-ink">{item.value}</p>
          </div>
        ) : item.type === "point" ? (
          <p key={i} className="text-[0.93rem] text-ink-2 sm:col-span-2">
            {item.text}
          </p>
        ) : null,
      )}
    </div>
  );
}

/** Contact: one card per office, phone and email as links. */
function Offices({ items }: { items: OfferItem[] }) {
  const offices: Array<{ name: string | null; rows: Array<{ label: string; value: string }> }> = [];
  for (const item of items) {
    if (item.type === "sub" || offices.length === 0) {
      offices.push({ name: item.type === "sub" ? item.text : null, rows: [] });
    }
    if (item.type === "row") offices[offices.length - 1]!.rows.push(item);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {offices
        .filter((o) => o.rows.length > 0)
        .map((o, i) => (
          <div key={i} className="rounded-[12px] border border-rule p-4">
            {o.name && <p className="font-semibold text-ink">{o.name}</p>}
            <dl className="mt-2 grid gap-1.5 text-[0.86rem]">
              {o.rows.map((r, k) => {
                const phone = /mobile|phone|tel/i.test(r.label);
                const email = /e-?mail/i.test(r.label);
                return (
                  <div key={k} className="flex items-start gap-2">
                    <Icon
                      name={phone ? "chat" : email ? "doc" : "pin"}
                      className="mt-0.5 size-4 shrink-0 text-ink-3"
                    />
                    <dt className="sr-only">{r.label}</dt>
                    <dd className="min-w-0 break-words text-ink-2">
                      {phone ? (
                        <a href={`tel:${r.value.replace(/[^\d+]/g, "")}`}>{r.value}</a>
                      ) : email ? (
                        <a href={`mailto:${r.value}`}>{r.value}</a>
                      ) : (
                        r.value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
    </div>
  );
}

/** Offer details laid out as titled cards: inclusions, hotels, requirements, policies, offices. */
export async function OfferSections({ sections }: { sections: OfferSection[] }) {
  const t = await getTranslations("offers.sections");
  return (
    <div className="grid gap-5">
      {sections.map((s, i) => (
        <section key={i} className="panel p-5 md:p-7" aria-labelledby={`offer-s-${i}`}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-ink">
              <Icon name={ICON[s.kind]} className="size-5" />
            </span>
            <h2
              id={`offer-s-${i}`}
              className="font-display text-[1.45rem] font-medium leading-tight"
            >
              {s.kind === "other" ? (s.title ?? t("about")) : t(s.kind)}
            </h2>
          </div>
          <div className="mt-5 grid gap-4">
            {s.kind === "contact" ? (
              <Offices items={s.items} />
            ) : s.kind === "hotels" ? (
              <HotelTiles items={s.items} />
            ) : (
              runs(s.items).map((run, k) =>
                run.type === "sub" ? (
                  <h3
                    key={k}
                    className="-mb-1 text-[0.76rem] font-bold uppercase tracking-[0.12em] text-ink-3"
                  >
                    {(run.items[0] as { text: string }).text}
                  </h3>
                ) : run.type === "row" ? (
                  <Rows key={k} items={run.items} />
                ) : (
                  <Points
                    key={k}
                    items={run.items}
                    columns={s.kind === "included" && run.items.length > 4}
                  />
                ),
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
