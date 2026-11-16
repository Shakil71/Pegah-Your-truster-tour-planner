import type { StaticImageData } from "next/image";
import coxsBazar from "@/assets/images/coxs-bazar-sunset.jpg";
import saintMartin from "@/assets/images/saint-martin-boats.jpg";

/**
 * Built-in seasonal gift card themes, shown on /gift-cards until the owner
 * adds designs in the console (Gift cards → Card designs). A theme only preselects an
 * amount and a gift message: the card itself is an ordinary Pegah gift card,
 * usable on any stay or tour (the page says so). Names, lines and messages
 * live in messages/*.json under giftCards.themes.<id>.
 *
 * Photos are licensed; credits are in docs/design/IMAGE_CREDITS.md.
 */
export type GiftCardTheme = {
  id: string;
  /** Message key for the destination name (giftCards.places.<place>). */
  place: "coxsBazar" | "saintMartin";
  amountTaka: number;
  image: StaticImageData;
  /** CSS object-position, so two cards sharing a photo still look different. */
  focus: string;
  credit: string;
};

const COXS_CREDIT = "Photo: CAPTAIN RAJU · CC0";
const SAINT_MARTIN_CREDIT = "Photo: Tanvir Rahat · CC BY-SA 4.0";

export const GIFT_CARD_THEMES: GiftCardTheme[] = [
  {
    id: "coxs-sunset",
    place: "coxsBazar",
    amountTaka: 3000,
    image: coxsBazar,
    focus: "50% 60%",
    credit: COXS_CREDIT,
  },
  {
    id: "saint-martin-escape",
    place: "saintMartin",
    amountTaka: 5000,
    image: saintMartin,
    focus: "50% 50%",
    credit: SAINT_MARTIN_CREDIT,
  },
  {
    id: "coxs-family",
    place: "coxsBazar",
    amountTaka: 10000,
    image: coxsBazar,
    focus: "15% 40%",
    credit: COXS_CREDIT,
  },
  {
    id: "saint-martin-coral",
    place: "saintMartin",
    amountTaka: 15000,
    image: saintMartin,
    focus: "85% 60%",
    credit: SAINT_MARTIN_CREDIT,
  },
];
