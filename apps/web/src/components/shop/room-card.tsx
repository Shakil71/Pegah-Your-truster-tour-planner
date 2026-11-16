import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Schemas } from "@pegah/api-client";
import { Icon, buttonClass } from "@pegah/ui";
import { money } from "@/lib/format";
import { isLibraryImage } from "@/lib/media";
import { cleanText, featureList } from "@/lib/text";
import { stayQuery, type StayParams } from "@/lib/trip";

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

/** Highlights shown before "Show all room details". */
const SHOWN = 6;

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
  const cover = info?.gallery[0];
  const photoCount = info?.gallery.length ?? 0;
  // Some imported rooms repeat their name as the whole description.
  const highlights = featureList(room.description).filter(
    (h) => h.toLowerCase() !== cleanText(room.name).toLowerCase(),
  );
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
        {/* Fixed 4:3 at the top: the photo never stretches with a long description. */}
        <div className="relative aspect-[4/3] overflow-hidden bg-paper-2 sm:m-5 sm:mr-0 sm:self-start sm:rounded-[12px] md:m-6 md:mr-0">
          {cover ? (
            <Image
              src={cover.url}
              alt={cover.alt}
              fill
              unoptimized={isLibraryImage(cover.url)}
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full min-h-[160px] place-items-center text-ink-3">
              <Icon name="bed" className="size-9" />
            </div>
          )}
          {photoCount > 1 && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-night/75 px-2.5 py-1 text-[0.72rem] font-semibold text-white backdrop-blur">
              <Icon name="view" className="size-3.5" />
              {t("photoTotal", { count: photoCount })}
            </span>
          )}
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

          {highlights.length > 0 && (
            <div className="mt-4">
              <ul className="grid gap-y-2 text-[0.9rem] leading-snug text-ink-2">
                {highlights.slice(0, SHOWN).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Icon name="check" className="mt-[3px] size-4 shrink-0 text-good" />
                    <span className="min-w-0">{h}</span>
                  </li>
                ))}
              </ul>
              {highlights.length > SHOWN && (
                <details className="group mt-2">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[0.84rem] font-semibold text-primary-ink [&::-webkit-details-marker]:hidden">
                    {t("allRoomDetails", { count: highlights.length - SHOWN })}
                    <Icon
                      name="arrowRight"
                      className="size-4 rotate-90 transition-transform group-open:-rotate-90"
                    />
                  </summary>
                  <ul className="mt-2 grid gap-y-2 text-[0.9rem] leading-snug text-ink-2">
                    {highlights.slice(SHOWN).map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Icon name="check" className="mt-[3px] size-4 shrink-0 text-good" />
                        <span className="min-w-0">{h}</span>
                      </li>
                    ))}
                  </ul>
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
