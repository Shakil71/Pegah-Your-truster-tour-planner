import Image from "next/image";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Icon, cx } from "@pegah/ui";
import { serverApi } from "@/lib/api-server";

/**
 * Promotional banners the owner schedules in the console (ADR-0032). Renders
 * nothing when no ad is live for this placement.
 */
export async function AdBanner({
  placement,
  className,
}: {
  placement: "HOME_TOP" | "HOME_MIDDLE" | "OFFERS_TOP";
  className?: string;
}) {
  const api = await serverApi();
  const ads =
    (await api.GET("/api/v1/ads", { params: { query: { placement } } })).data?.items ?? [];
  if (ads.length === 0) return null;
  const bn = (await getLocale()) === "bn";
  return (
    <div className={cx("grid gap-4", ads.length > 1 && "md:grid-cols-2", className)}>
      {ads.slice(0, 2).map((ad) => {
        const title = bn ? ad.titleBn : ad.titleEn;
        const text = bn ? ad.textBn : ad.textEn;
        const body = (
          <>
            <Image
              src={ad.image.url}
              alt={ad.image.alt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-pegah group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgb(9_12_34/0.82),rgb(9_12_34/0.25)_75%)]" />
            <span className="relative grid max-w-[40ch] gap-1 p-6 md:p-8">
              <span className="font-display text-[clamp(1.5rem,2.6vw,2.2rem)] font-medium leading-tight">
                {title}
              </span>
              {text && <span className="text-[0.95rem] text-white/85">{text}</span>}
              {ad.linkHref && (
                <span className="mt-3 inline-flex items-center gap-1.5 justify-self-start rounded-full bg-primary px-4 py-2 text-[0.88rem] font-semibold text-on-primary">
                  {bn ? "বিস্তারিত" : "See more"} <Icon name="arrowRight" className="size-4" />
                </span>
              )}
            </span>
          </>
        );
        const cls =
          "group relative flex min-h-[200px] items-center overflow-hidden rounded-card bg-night text-white no-underline";
        return ad.linkHref ? (
          <Link key={ad.id} href={ad.linkHref} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={ad.id} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
