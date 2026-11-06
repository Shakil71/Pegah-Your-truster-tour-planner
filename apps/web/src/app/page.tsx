import { getLocale } from "next-intl/server";
import { currentRitu } from "@pegah/shared";
import { AdBanner } from "@/components/ad-banner";
import { FeaturedDestinations, FeaturedStays, FeaturedTours } from "@/components/featured";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { MoodMosaic } from "@/components/mood-mosaic";
import { Newsletter } from "@/components/newsletter";
import { Promises } from "@/components/promises";
import { SearchPanel } from "@/components/search-panel";
import { SeasonsPanel } from "@/components/seasons-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteNotice } from "@/components/site-notice";
import { StaysGrid } from "@/components/stays-grid";
import { ToursSection } from "@/components/tours-section";
import { TrendingRail } from "@/components/trending-rail";
import { serverApi } from "@/lib/api-server";

export const dynamic = "force-dynamic";

/**
 * Home page. Sections chosen in the console (ADR-0031) use the real catalog;
 * a section nobody has set up yet shows the built-in content instead.
 */
export default async function HomePage() {
  const ritu = currentRitu();
  const locale = await getLocale();
  const bn = locale === "bn";
  const api = await serverApi();
  const home = (await api.GET("/api/v1/home")).data;
  const season = bn ? ritu.bn : ritu.en;

  return (
    <>
      <SiteHeader />
      <main id="top">
        <HeroSlideshow
          slides={home?.slides.map((s) => ({
            src: s.url,
            alt: s.alt,
            place: bn ? s.placeBn : s.placeEn,
            credit: s.credit,
          }))}
        />
        <div className="px-[max(16px,env(safe-area-inset-left,0px))]">
          <SearchPanel />
          <div className="mx-auto max-w-[1280px]">
            <SiteNotice className="mt-6" />
            <AdBanner placement="HOME_TOP" className="mt-6" />
          </div>
        </div>
        {home?.destinations.length ? (
          <FeaturedDestinations items={home.destinations} season={season} />
        ) : (
          <TrendingRail season={season} />
        )}
        <MoodMosaic />
        <div className="px-[max(16px,env(safe-area-inset-left,0px))] pt-16">
          <div className="mx-auto max-w-[1280px]">
            <AdBanner placement="HOME_MIDDLE" />
          </div>
        </div>
        {home?.hotels.length ? <FeaturedStays items={home.hotels} /> : <StaysGrid />}
        <SeasonsPanel current={ritu.key} />
        {home?.tours.length ? <FeaturedTours items={home.tours} /> : <ToursSection />}
        <Promises
          items={home?.promises.map((p) => ({
            title: bn ? p.titleBn : p.titleEn,
            body: bn ? p.bodyBn : p.bodyEn,
          }))}
        />
        <Newsletter />
      </main>
      <SiteFooter />
    </>
  );
}
