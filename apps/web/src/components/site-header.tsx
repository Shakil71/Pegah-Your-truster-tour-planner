import { serverApi } from "@/lib/api-server";
import { SiteHeaderClient, type NavItem } from "./site-header-client";

/**
 * Site header. The menu always has Hotels, Tours, Offers, Gift cards, About
 * and Contact; Stays (date search), Flights and Visa appear only when the
 * owner turns them on in Console → Settings → Website menu (ADR-0041). Those
 * pages keep working either way and are linked from My account.
 */
export async function SiteHeader({ solid }: { solid?: boolean }) {
  const api = await serverApi();
  const menu = (await api.GET("/api/v1/site")).data?.menu;
  const nav: NavItem[] = [
    { href: "/hotels", key: "hotels" },
    ...(menu?.showStays ? [{ href: "/stays", key: "stays" } as const] : []),
    { href: "/tours", key: "tours" },
    ...(menu?.showFlights ? [{ href: "/flights", key: "flights" } as const] : []),
    ...(menu?.showVisa ? [{ href: "/visa", key: "visa" } as const] : []),
    { href: "/offers", key: "offers" },
    { href: "/gift-cards", key: "giftCards" },
    { href: "/about", key: "about" },
    { href: "/contact", key: "contact" },
  ];
  return <SiteHeaderClient solid={solid} nav={nav} />;
}
