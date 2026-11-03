import { currentRitu } from "@pegah/shared";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { MoodMosaic } from "@/components/mood-mosaic";
import { Newsletter } from "@/components/newsletter";
import { Promises } from "@/components/promises";
import { SearchPanel } from "@/components/search-panel";
import { SeasonsPanel } from "@/components/seasons-panel";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StaysGrid } from "@/components/stays-grid";
import { ToursSection } from "@/components/tours-section";
import { TrendingRail } from "@/components/trending-rail";

/** Re-render hourly so the "current season" follows the Asia/Dhaka calendar. */
export const revalidate = 3600;

export default function HomePage() {
  const ritu = currentRitu();
  return (
    <>
      <SiteHeader />
      <main id="top">
        <HeroSlideshow />
        <div className="px-[max(16px,env(safe-area-inset-left,0px))]">
          <SearchPanel />
        </div>
        <TrendingRail season={ritu.en} />
        <MoodMosaic />
        <StaysGrid />
        <SeasonsPanel current={ritu.key} />
        <ToursSection />
        <Promises />
        <Newsletter />
      </main>
      <SiteFooter />
    </>
  );
}
