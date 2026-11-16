import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Schemas } from "@pegah/api-client";
import { Icon, buttonClass } from "@pegah/ui";
import { money } from "@/lib/format";
import { cleanText, detailSections, type DetailSection } from "@/lib/text";
import { stayQuery, type StayParams } from "@/lib/trip";
import { RoomPhotos } from "./room-photos";

type Offer = Schemas["HotelRoomOffer_Output"];
type RoomInfo = Schemas["HotelDetailDto_Output"]["rooms"][number];

/** Why a room cannot be booked, as a message key (API reason → text). */
const REASONS: Record<string, string> = {
  occupancy: "reasonOccupancy",
  "no-inventory": "reasonNotOnSale",
  "sold-out": "reasonSoldOut",
  "no-rate": "reasonNotOnSale",
  currency: "reasonUnavailable",
};

/** Points shown before "Show more room details". */
const SHOWN = 6;

/** The first `n` points (keeping their section titles), and the rest. */
function splitAfter(sections: DetailSection[], n: number) {
  const shown: DetailSection[] = [];
  const rest: DetailSection[] = [];
  let left = n;
  for (const s of sections) {
    const head = s.points.slice(0, Math.max(left, 0));
    const tail = s.points.slice(head.length);
    if (head.length > 0) shown.push({ title: s.title, points: head });
    if (tail.length > 0) rest.push({ title: head.length > 0 ? null : s.title, points: tail });
    left -= head.length;
  }
  return { shown, rest, restCount: rest.reduce((c, s) => c + s.points.length, 0) };
}

function Points({ sections }: { sections: DetailSection[] }) {
  return (
    <div className="grid gap-3">
      {sections.map((s, i) => (
        <div key={`${s.title ?? ""}-${i}`}>
          {s.title && (
            <h4 className="mb-1.5 text-[0.74rem] font-bold uppercase tracking-[0.1em] text-ink-3">
              {s.title}
            </h4>
          )}
          <ul className="grid gap-y-2 text-[0.9rem] leading-snug text-ink-2">
            {s.points.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Icon name="check" className="mt-[3px] size-4 shrink-0 text-good" />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * One room on a hotel page: photo, key facts, highlights, facilities and
 * the price (computed by the server for the chosen dates). When the room is
 * not on sale for those dates, the guest can ask the team directly instead
 * of hitting a dead end; nothing is held or confirmed by asking.
 */
export async function RoomCard({
  offer,
  info,
  hotelName,
  stay,
  isAgent,
  contact,
}: {
  offer: Offer;
  info: RoomInfo | undefined;
  hotelName: string;
  stay: StayParams;
  isAgent: boolean;
  contact: { whatsapp: string; phone: string } | null;
}) {
  const t = await getTranslations("property");
  const room = offer.room;
  // Full details when the room has them (the description was clipped on
  // import, ADR-0038); a description that only repeats the name is skipped.
  const name = cleanText(room.name).toLowerCase();
  const sections = detailSections(info?.details || room.description)
    .map((s) => ({ ...s, points: s.points.filter((p) => p.toLowerCase() !== name) }))
    .filter((s) => s.points.length > 0);
  const { shown, rest, restCount } = splitAfter(sections, SHOWN);
  const amenities = info?.amenities ?? [];
  const reason = t(REASONS[offer.reason ?? ""] ?? "reasonUnavailable");

  const ask = encodeURIComponent(
    t("askMessage", {
      room: cleanText(room.name),
      hotel: hotelName,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adults: stay.adults,
      children: stay.children,
      rooms: stay.rooms,
    }),
  );
  const whatsapp = contact?.whatsapp.replace(/[^\d]/g, "");

  return (
    <article className="panel overflow-hidden">
      <div className="grid sm:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Main photo at a fixed 4:3 with the other photos underneath; never stretches with the text. */}
        <div className="p-4 pb-0 sm:self-start sm:p-5 sm:pr-0 md:p-6 md:pr-0">
          <RoomPhotos
            photos={info?.gallery ?? []}
            countLabel={t("photoTotal", { count: info?.gallery.length ?? 0 })}
            labels={{
              title: t("photos", { name: cleanText(room.name) }),
              open: t("openPhoto"),
              close: t("closePhotos"),
              previous: t("previousPhoto"),
              next: t("nextPhoto"),
              count: t("photoCount"),
            }}
          />
        </div>

        <div className="flex min-w-0 flex-col p-5 md:p-6">
          <h3 className="font-display text-[1.45rem] font-medium leading-tight">
            {cleanText(room.name)}
          </h3>

          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.84rem] text-ink-2">
            <li className="inline-flex items-center gap-1.5">
              <Icon name="bed" className="size-4 text-ink-3" /> {cleanText(room.bedType)}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Icon name="users" className="size-4 text-ink-3" />
              {t("occupancy", { adults: room.maxAdults, children: room.maxChildren })}
            </li>
            {room.sizeSqm && <li>{room.sizeSqm} m²</li>}
            {info?.airConditioned !== null && info?.airConditioned !== undefined && (
              <li>{info.airConditioned ? t("airConditioned") : t("noAirConditioning")}</li>
            )}
            {info && info.extraBeds > 0 && <li>{t("extraBeds", { count: info.extraBeds })}</li>}
          </ul>

          {shown.length > 0 && (
            <div className="mt-4">
              <Points sections={shown} />
              {restCount > 0 && (
                <details className="group mt-3">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-rule px-3 py-1 text-[0.82rem] font-semibold text-primary-ink hover:border-ink [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">
                      {t("allRoomDetails", { count: restCount })}
                    </span>
                    <span className="hidden group-open:inline">{t("fewerRoomDetails")}</span>
                    <Icon
                      name="arrowRight"
                      className="size-4 rotate-90 transition-transform group-open:-rotate-90"
                    />
                  </summary>
                  <div className="mt-3">
                    <Points sections={rest} />
                  </div>
                </details>
              )}
            </div>
          )}

          {amenities.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("roomFacilities")}>
              {amenities.slice(0, 6).map((a) => (
                <li
                  key={a.slug}
                  className="rounded-full border border-rule px-2.5 py-0.5 text-[0.75rem] text-ink-2"
                >
                  {cleanText(a.name)}
                </li>
              ))}
              {amenities.length > 6 && (
                <li className="px-1 py-0.5 text-[0.75rem] text-ink-3">
                  {t("moreFacilities", { count: amenities.length - 6 })}
                </li>
              )}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-4">
            {offer.available && offer.price ? (
              <>
                <div>
                  <p className="tabular font-display text-[1.8rem] font-medium leading-none">
                    {money(offer.price.total)}
                  </p>
                  <p className="mt-1 text-[0.76rem] text-ink-3">
                    {t("roomsInclTaxes", { rooms: stay.rooms })}
                  </p>
                  {offer.roomsLeft !== null && offer.roomsLeft <= 3 && (
                    <p className="mt-1 text-[0.8rem] font-semibold text-warn">
                      {t("onlyLeft", { count: offer.roomsLeft })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAgent && (
                    <Link
                      href={`/checkout?${stayQuery(stay, { product: "HOTEL", room: room.id, as: "agent" })}`}
                      className={buttonClass("outline", "md", "no-underline")}
                    >
                      {t("bookForClient")}
                    </Link>
                  )}
                  <Link
                    href={`/checkout?${stayQuery(stay, { product: "HOTEL", room: room.id })}`}
                    className={buttonClass("primary", "md", "no-underline")}
                  >
                    {t("holdRoom")}
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0 max-w-[42ch]">
                  <p className="inline-flex items-center gap-1.5 text-[0.86rem] font-semibold text-ink">
                    <Icon name="calendar" className="size-4 text-ink-3" />
                    {reason}
                  </p>
                  {contact && <p className="mt-1 text-[0.8rem] text-ink-3">{t("askHint")}</p>}
                </div>
                {contact && (
                  <div className="flex flex-wrap gap-2">
                    {whatsapp && (
                      <a
                        href={`https://wa.me/${whatsapp}?text=${ask}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonClass("primary", "md", "no-underline")}
                      >
                        {t("askOnWhatsApp")}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                        className={buttonClass("outline", "md", "no-underline")}
                      >
                        {t("callUs")}
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
