/**
 * SAMPLE CONTENT for design review. Not real inventory: names, scores,
 * departures and prices are illustrative until the catalog API exists
 * (Phase 4). Photos are licensed; see docs/design/IMAGE_CREDITS.md.
 */
import type { StaticImageData } from "next/image";
import type { IconName } from "@pegah/ui";
import type { RituKey } from "@pegah/shared";

import boga from "@/assets/images/hero-boga-lake.jpg";
import coxs from "@/assets/images/coxs-bazar-sunset.jpg";
import jaflong from "@/assets/images/jaflong-tea-mist.jpg";
import kaptai from "@/assets/images/kaptai-bridge.jpg";
import lawachara from "@/assets/images/lawachara-mist.jpg";
import nafakhum from "@/assets/images/nafakhum-falls.jpg";
import panam from "@/assets/images/panam-city.jpg";
import ratargulHero from "@/assets/images/hero-ratargul-boatman.jpg";
import ratargul from "@/assets/images/ratargul-boatman.jpg";
import saintMartin from "@/assets/images/saint-martin-boats.jpg";
import sajek from "@/assets/images/sajek-sunrise.jpg";
import srimangal from "@/assets/images/srimangal-tea.jpg";
import sundarbans from "@/assets/images/hero-sundarbans-sunrise.jpg";
import tanguarCrossing from "@/assets/images/tanguar-crossing.jpg";
import tanguarBoat from "@/assets/images/tanguar-houseboat.jpg";

export type Photo = { src: StaticImageData; alt: string; credit?: string };

export const heroSlides: Array<Photo & { place: string; credit: string }> = [
  {
    src: jaflong,
    place: "Jaflong, Sylhet",
    credit: "Photo: Abdul Momin · CC BY-SA 4.0",
    alt: "A tea worker walks through a tea garden at Jaflong as misty hills glow orange at dawn.",
  },
  {
    src: sundarbans,
    place: "Sundarbans, Khulna",
    credit: "Photo: Hiroki Ogawa · CC BY 3.0",
    alt: "The sun rises through mist over a mangrove channel in the Sundarbans.",
  },
  {
    src: ratargulHero,
    place: "Ratargul, Sylhet",
    credit: "Photo: Abdulmominbd · CC BY-SA 4.0",
    alt: "A boatman paddles under arching trees in the Ratargul swamp forest.",
  },
  {
    src: boga,
    place: "Boga Lake, Bandarban",
    credit: "Photo: Mazharul Sabuz · CC BY-SA 4.0",
    alt: "Clouds reflected in the still water of Boga Lake, ringed by forested hills.",
  },
];

export const quickPicks = [
  { label: "Tea-garden weekend", query: "Srimangal, Sylhet" },
  { label: "Sea-view in Cox’s Bazar", query: "Cox's Bazar" },
  { label: "Sajek cottages", query: "Sajek Valley, Rangamati" },
  { label: "Saint Martin’s", query: "Saint Martin's Island" },
];

export const places = [
  "Srimangal, Sylhet",
  "Jaflong, Sylhet",
  "Ratargul, Sylhet",
  "Sundarbans",
  "Tanguar Haor, Sunamganj",
  "Sajek Valley, Rangamati",
  "Kaptai Lake, Rangamati",
  "Bandarban",
  "Cox's Bazar",
  "Saint Martin's Island",
  "Old Dhaka",
  "Sonargaon",
];

export const trust: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "taka", title: "Prices in taka", body: "VAT and fees included before you pay" },
  { icon: "shield", title: "Really confirmed", body: "Confirmed only when your host confirms" },
  { icon: "wallet", title: "Pay your way", body: "Cards, bKash and Nagad via secure checkout" },
  { icon: "chat", title: "A named planner", body: "One person to call, start to finish" },
];

export const trending: Array<{
  name: string;
  sub: string;
  from: number;
  tag?: string;
  photo: Photo;
}> = [
  {
    name: "Sajek Valley",
    sub: "Rangamati · above the clouds",
    from: 6200,
    tag: "Best now",
    photo: { src: sajek, alt: "Sunrise over misty hills at Sajek Valley." },
  },
  {
    name: "Cox’s Bazar",
    sub: "The longest natural sea beach",
    from: 7400,
    photo: { src: coxs, alt: "Sunset over the beach at Cox’s Bazar." },
  },
  {
    name: "Saint Martin’s",
    sub: "The coral island",
    from: 5900,
    photo: { src: saintMartin, alt: "Wooden fishing boats moored off Saint Martin’s Island." },
  },
  {
    name: "Srimangal",
    sub: "Tea capital of the country",
    from: 4800,
    photo: { src: srimangal, alt: "Rows of tea bushes on a hillside near Srimangal." },
  },
  {
    name: "Kaptai Lake",
    sub: "Rangamati · lake and hills",
    from: 4200,
    photo: { src: kaptai, alt: "The orange hanging bridge over Kaptai Lake." },
  },
  {
    name: "Nafakhum",
    sub: "Bandarban · trek to the falls",
    from: 3600,
    photo: { src: nafakhum, alt: "Nafakhum waterfall surrounded by green forest." },
  },
];

export const moods: Array<{ mood: string; name: string; photo: Photo }> = [
  {
    mood: "Wild",
    name: "The Sundarbans",
    photo: { src: sundarbans, alt: "Mist and sunrise over a Sundarbans channel." },
  },
  { mood: "Hills", name: "Bandarban", photo: { src: boga, alt: "Clouds reflected in Boga Lake." } },
  {
    mood: "Water",
    name: "The haors",
    photo: { src: tanguarCrossing, alt: "A wooden boat crossing Tanguar Haor." },
  },
  {
    mood: "Heritage",
    name: "Panam City",
    photo: { src: panam, alt: "Old brick mansions along the main street of Panam City." },
  },
  {
    mood: "Forest",
    name: "Lawachara",
    photo: { src: lawachara, alt: "Tall thin trees in morning mist at Lawachara." },
  },
  {
    mood: "Sea",
    name: "The coast",
    photo: { src: saintMartin, alt: "Fishing boats off Saint Martin’s Island." },
  },
];

export type Stay = {
  name: string;
  location: string;
  score: number;
  scoreLabel: string;
  freeCancellation: boolean;
  amenities: Array<{ icon: IconName; label: string }>;
  pricePerNight: number;
  photo: Photo;
};

export const stays: Stay[] = [
  {
    name: "Tea Estate Bungalow",
    location: "Srimangal, Moulvibazar",
    score: 9.2,
    scoreLabel: "Superb",
    freeCancellation: true,
    amenities: [
      { icon: "wifi", label: "Wi-Fi" },
      { icon: "cup", label: "Breakfast" },
      { icon: "view", label: "Garden view" },
    ],
    pricePerNight: 8400,
    photo: { src: srimangal, alt: "Tea garden slopes beside a bungalow stay in Srimangal." },
  },
  {
    name: "Lakeside Hill Cottage",
    location: "Ruma, Bandarban",
    score: 8.8,
    scoreLabel: "Excellent",
    freeCancellation: true,
    amenities: [
      { icon: "cup", label: "Breakfast" },
      { icon: "view", label: "Lake view" },
      { icon: "car", label: "Transfer" },
    ],
    pricePerNight: 5200,
    photo: { src: boga, alt: "Lake and forested hills near a cottage in Bandarban." },
  },
  {
    name: "Marine Drive Sea-View Suites",
    location: "Inani, Cox’s Bazar",
    score: 8.6,
    scoreLabel: "Excellent",
    freeCancellation: false,
    amenities: [
      { icon: "wifi", label: "Wi-Fi" },
      { icon: "view", label: "Sea view" },
      { icon: "cup", label: "Breakfast" },
    ],
    pricePerNight: 9900,
    photo: { src: coxs, alt: "Sunset over the sea at Cox’s Bazar." },
  },
  {
    name: "Kaptai Lake Floating Lodge",
    location: "Rangamati Sadar",
    score: 8.9,
    scoreLabel: "Excellent",
    freeCancellation: true,
    amenities: [
      { icon: "cup", label: "Breakfast" },
      { icon: "view", label: "Lake view" },
      { icon: "boat", label: "Boat transfer" },
    ],
    pricePerNight: 6700,
    photo: { src: kaptai, alt: "Kaptai Lake near a lakeside lodge in Rangamati." },
  },
];

export const seasonGuide: Record<
  RituKey,
  { caption: string; note: string; go: string[]; photo: Photo }
> = {
  grishma: {
    caption: "Srimangal tea gardens",
    go: ["Srimangal", "Sajek Valley", "Old Dhaka"],
    note: "Summer. Hot on the plains, so head for altitude and shade. The first flush is being plucked in the tea gardens.",
    photo: { src: srimangal, alt: "" },
  },
  barsha: {
    caption: "Ratargul in flood",
    go: ["Ratargul", "Tanguar Haor", "Jaflong"],
    note: "Monsoon. The season Ratargul and the haors are made for: the forest floods and the wetlands become an inland sea.",
    photo: { src: ratargulHero, alt: "" },
  },
  sharat: {
    caption: "Tanguar Haor",
    go: ["Tanguar Haor", "Sajek Valley", "Kaptai Lake"],
    note: "Early autumn. White kash flowers, clear skies over full water, and Sajek above a sea of cloud.",
    photo: { src: tanguarBoat, alt: "" },
  },
  hemanta: {
    caption: "Sunrise at Sajek",
    go: ["Sajek Valley", "Cox’s Bazar", "Sundarbans"],
    note: "Late autumn and harvest. Dry trails, cool mornings, and the beach and Sundarbans seasons opening.",
    photo: { src: sajek, alt: "" },
  },
  sheet: {
    caption: "Cox’s Bazar",
    go: ["Cox’s Bazar", "Saint Martin’s", "Sundarbans"],
    note: "Winter. Calm sea, mild days and migratory birds. Book coast and island stays early.",
    photo: { src: coxs, alt: "" },
  },
  basanta: {
    caption: "Jaflong at dawn",
    go: ["Jaflong", "Srimangal", "Panam City"],
    note: "Spring. Shimul and palash in flower, and the tea country turning green again.",
    photo: { src: jaflong, alt: "" },
  },
};

export const featuredTour = {
  label: "Sunamganj · 2 nights · houseboat",
  name: "Tanguar Haor by houseboat",
  facts: ["Departs Sunamganj ghat, 7:00", "8 guests per boat", "Cabin, all meals, life jackets"],
  departures: [
    { date: "Thu 12 Nov", seatsLeft: 3, price: 14500 },
    { date: "Thu 19 Nov", seatsLeft: 6, price: 14500 },
    { date: "Thu 26 Nov", seatsLeft: 8, price: 15800 },
  ],
  photo: {
    src: tanguarBoat,
    alt: "A wooden houseboat crossing Tanguar Haor under a blue sky.",
  } satisfies Photo,
};

export const tours: Array<{
  label: string;
  name: string;
  blurb: string;
  from: number;
  photo: Photo;
}> = [
  {
    label: "Khulna · 3 days",
    name: "Sundarbans launch cruise",
    blurb: "Katka and Kochikhali by launch, with forest guard and guide on board.",
    from: 16900,
    photo: { src: sundarbans, alt: "Sunrise over a Sundarbans channel." },
  },
  {
    label: "Sylhet · Day trip",
    name: "Ratargul by dinghy",
    blurb: "Two hours among submerged koroch trees, then a village lunch.",
    from: 3200,
    photo: { src: ratargul, alt: "A boatman in Ratargul swamp forest." },
  },
  {
    label: "Sonargaon · Day trip",
    name: "Panam City and the folk museum",
    blurb: "The old merchant street, Goaldi Mosque and the Folk Arts museum.",
    from: 2900,
    photo: { src: panam, alt: "Panam City’s old brick street." },
  },
  {
    label: "Bandarban · 4 days",
    name: "Thanchi to Nafakhum trek",
    blurb: "Boat up the Sangu, two nights in Remakri, guided walk to the falls.",
    from: 13500,
    photo: { src: nafakhum, alt: "Nafakhum waterfall." },
  },
];

export const promises: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "taka",
    title: "The price is the price.",
    body: "Taxes, VAT and service charges are in the number you see before you pay. Nothing is added at the last step.",
  },
  {
    icon: "shield",
    title: "Confirmed means confirmed.",
    body: "We only call a booking confirmed when the hotel or operator has confirmed it to us, and your voucher arrives the same minute.",
  },
  {
    icon: "chat",
    title: "A planner, not a ticket number.",
    body: "Every trip has one named Pegah planner you can call or message, from booking until you are home.",
  },
];

export const newsletterPhoto: Photo = {
  src: lawachara,
  alt: "",
  credit: "Lawachara · Photo: Abdulmominbd, CC BY-SA 4.0",
};

export const photoCredits = [
  "Jaflong tea garden: Abdul Momin, CC BY-SA 4.0",
  "Sundarbans sunrise: Hiroki Ogawa, CC BY 3.0",
  "Ratargul boatman: Abdulmominbd (retouched by Aristeas, Iifar), CC BY-SA 4.0",
  "Boga Lake: Mazharul Sabuz, CC BY-SA 4.0",
  "Sajek sunrise: Rocky Masum, CC BY-SA 4.0",
  "Tanguar Haor houseboat and crossing: Ahnaf Tahmid Manan, CC BY-SA 4.0",
  "Srimangal tea garden: Xahidur Reza, CC BY 2.0",
  "Cox’s Bazar sunset: CAPTAIN RAJU, CC0",
  "Saint Martin’s Island: Tanvir Rahat, CC BY-SA 4.0",
  "Kaptai Lake hanging bridge: Shakhawat Hossen Shafat, CC BY-SA 4.0",
  "Nafakhum waterfall: Laj Mahmud, CC BY-SA 4.0",
  "Panam City: Nafiul Ahmed Rafi, CC BY-SA 4.0",
  "Lawachara forest: Abdulmominbd, CC BY-SA 4.0",
];
