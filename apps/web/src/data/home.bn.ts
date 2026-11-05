import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";

/**
 * Bangla for the home page's static content in data/home.ts (place names,
 * sample cards, captions). Keyed by the English text; anything missing falls
 * back to English. Interface wording lives in messages/*.json (ADR-0028).
 */
const BN: Record<string, string> = {
  // Places
  "Jaflong, Sylhet": "জাফলং, সিলেট",
  "Sundarbans, Khulna": "সুন্দরবন, খুলনা",
  "Ratargul, Sylhet": "রাতারগুল, সিলেট",
  "Boga Lake, Bandarban": "বগা লেক, বান্দরবান",
  "Sajek Valley": "সাজেক ভ্যালি",
  "Cox’s Bazar": "কক্সবাজার",
  "Saint Martin’s": "সেন্ট মার্টিন",
  Srimangal: "শ্রীমঙ্গল",
  "Kaptai Lake": "কাপ্তাই লেক",
  Nafakhum: "নাফাখুম",
  "The Sundarbans": "সুন্দরবন",
  Bandarban: "বান্দরবান",
  "The haors": "হাওর",
  "Panam City": "পানাম নগর",
  Lawachara: "লাউয়াছড়া",
  "The coast": "উপকূল",
  Ratargul: "রাতারগুল",
  "Tanguar Haor": "টাঙ্গুয়ার হাওর",
  Jaflong: "জাফলং",
  "Old Dhaka": "পুরান ঢাকা",
  Sundarbans: "সুন্দরবন",
  // Quick picks and trust row
  "Tea-garden weekend": "চা-বাগানে সপ্তাহান্ত",
  "Sea-view in Cox’s Bazar": "কক্সবাজারে সমুদ্রমুখী",
  "Sajek cottages": "সাজেকের কটেজ",
  "Prices in taka": "দাম টাকায়",
  "VAT and fees included before you pay": "পেমেন্টের আগেই ভ্যাট ও ফি যুক্ত",
  "Really confirmed": "সত্যিকারের নিশ্চিত",
  "Confirmed only when your host confirms": "হোস্ট নিশ্চিত করলেই কেবল কনফার্মড",
  "Pay your way": "যেভাবে সুবিধা পেমেন্ট করুন",
  "Cards, bKash and Nagad via secure checkout": "নিরাপদ চেকআউটে কার্ড, বিকাশ ও নগদ",
  "A named planner": "নির্দিষ্ট একজন প্ল্যানার",
  "One person to call, start to finish": "শুরু থেকে শেষ পর্যন্ত একজনই যোগাযোগের মানুষ",
  // Trending
  "Rangamati · above the clouds": "রাঙামাটি · মেঘের ওপরে",
  "The longest natural sea beach": "দীর্ঘতম প্রাকৃতিক সমুদ্রসৈকত",
  "The coral island": "প্রবাল দ্বীপ",
  "Tea capital of the country": "দেশের চায়ের রাজধানী",
  "Rangamati · lake and hills": "রাঙামাটি · হ্রদ আর পাহাড়",
  "Bandarban · trek to the falls": "বান্দরবান · ঝরনার পথে ট্রেক",
  "Best now": "এখনই সেরা",
  // Moods
  Wild: "বন্য",
  Hills: "পাহাড়",
  Water: "জল",
  Heritage: "ঐতিহ্য",
  Forest: "অরণ্য",
  Sea: "সমুদ্র",
  // Sample stays
  "Tea Estate Bungalow": "টি এস্টেট বাংলো",
  "Srimangal, Moulvibazar": "শ্রীমঙ্গল, মৌলভীবাজার",
  Superb: "অসাধারণ",
  Excellent: "চমৎকার",
  "Wi-Fi": "ওয়াই-ফাই",
  Breakfast: "নাশতা",
  "Garden view": "বাগানমুখী",
  "Lakeside Hill Cottage": "লেকপাড়ের পাহাড়ি কটেজ",
  "Ruma, Bandarban": "রুমা, বান্দরবান",
  "Lake view": "লেকমুখী",
  Transfer: "যাতায়াত",
  "Marine Drive Sea-View Suites": "মেরিন ড্রাইভ সি-ভিউ স্যুইট",
  "Inani, Cox’s Bazar": "ইনানী, কক্সবাজার",
  "Sea view": "সমুদ্রমুখী",
  "Kaptai Lake Floating Lodge": "কাপ্তাই লেক ভাসমান লজ",
  "Rangamati Sadar": "রাঙামাটি সদর",
  "Boat transfer": "নৌকায় যাতায়াত",
  // Seasons
  "Srimangal tea gardens": "শ্রীমঙ্গলের চা-বাগান",
  "Ratargul in flood": "বর্ষার রাতারগুল",
  "Sunrise at Sajek": "সাজেকে সূর্যোদয়",
  "Jaflong at dawn": "ভোরের জাফলং",
  "Summer. Hot on the plains, so head for altitude and shade. The first flush is being plucked in the tea gardens.":
    "গ্রীষ্ম। সমতলে গরম, তাই পাহাড় আর ছায়ার দিকে যান। চা-বাগানে চলছে প্রথম ফ্লাশের পাতা তোলা।",
  "Monsoon. The season Ratargul and the haors are made for: the forest floods and the wetlands become an inland sea.":
    "বর্ষা। রাতারগুল আর হাওরের আসল মৌসুম: বন ডুবে যায়, জলাভূমি হয়ে ওঠে যেন এক অন্তর্দেশীয় সাগর।",
  "Early autumn. White kash flowers, clear skies over full water, and Sajek above a sea of cloud.":
    "শরৎ। সাদা কাশফুল, ভরা জলের ওপর নীল আকাশ, আর মেঘের সাগরের ওপরে সাজেক।",
  "Late autumn and harvest. Dry trails, cool mornings, and the beach and Sundarbans seasons opening.":
    "হেমন্ত, ফসল তোলার কাল। শুকনো পথ, ঠান্ডা ভোর, আর সমুদ্রসৈকত ও সুন্দরবনের মৌসুম শুরু।",
  "Winter. Calm sea, mild days and migratory birds. Book coast and island stays early.":
    "শীত। শান্ত সমুদ্র, মৃদু দিন আর অতিথি পাখি। উপকূল আর দ্বীপের থাকা আগেভাগে বুক করুন।",
  "Spring. Shimul and palash in flower, and the tea country turning green again.":
    "বসন্ত। শিমুল-পলাশে ফুল, আর চায়ের দেশ আবার সবুজ হয়ে উঠছে।",
  // Tours
  "Sunamganj · 2 nights · houseboat": "সুনামগঞ্জ · ২ রাত · হাউসবোট",
  "Tanguar Haor by houseboat": "হাউসবোটে টাঙ্গুয়ার হাওর",
  "Departs Sunamganj ghat, 7:00": "সুনামগঞ্জ ঘাট থেকে যাত্রা, সকাল ৭টা",
  "8 guests per boat": "প্রতি নৌকায় ৮ জন অতিথি",
  "Cabin, all meals, life jackets": "কেবিন, সব বেলার খাবার, লাইফ জ্যাকেট",
  "Khulna · 3 days": "খুলনা · ৩ দিন",
  "Sundarbans launch cruise": "লঞ্চে সুন্দরবন ভ্রমণ",
  "Katka and Kochikhali by launch, with forest guard and guide on board.":
    "লঞ্চে কটকা ও কচিখালী, সঙ্গে বনরক্ষী ও গাইড।",
  "Sylhet · Day trip": "সিলেট · দিনের ভ্রমণ",
  "Ratargul by dinghy": "ডিঙিতে রাতারগুল",
  "Two hours among submerged koroch trees, then a village lunch.":
    "জলে ডোবা করচ গাছের ফাঁকে দুই ঘণ্টা, তারপর গ্রামের দুপুরের খাবার।",
  "Sonargaon · Day trip": "সোনারগাঁও · দিনের ভ্রমণ",
  "Panam City and the folk museum": "পানাম নগর ও লোকশিল্প জাদুঘর",
  "The old merchant street, Goaldi Mosque and the Folk Arts museum.":
    "পুরোনো বণিক সড়ক, গোয়ালদী মসজিদ আর লোকশিল্প জাদুঘর।",
  "Bandarban · 4 days": "বান্দরবান · ৪ দিন",
  "Thanchi to Nafakhum trek": "থানচি থেকে নাফাখুম ট্রেক",
  "Boat up the Sangu, two nights in Remakri, guided walk to the falls.":
    "সাঙ্গু নদী বেয়ে নৌকা, রেমাক্রিতে দুই রাত, গাইডের সঙ্গে ঝরনা পর্যন্ত হাঁটা।",
  // Promises
  "The price is the price.": "যে দাম দেখবেন, সেটাই দাম।",
  "Taxes, VAT and service charges are in the number you see before you pay. Nothing is added at the last step.":
    "কর, ভ্যাট আর সার্ভিস চার্জ পেমেন্টের আগে দেখানো অঙ্কেই থাকে। শেষ ধাপে কিছুই যোগ হয় না।",
  "Confirmed means confirmed.": "কনফার্মড মানে সত্যিই কনফার্মড।",
  "We only call a booking confirmed when the hotel or operator has confirmed it to us, and your voucher arrives the same minute.":
    "হোটেল বা অপারেটর আমাদের নিশ্চিত করলে তবেই বুকিংকে কনফার্মড বলি, আর সেই মুহূর্তেই আপনার ভাউচার পৌঁছে যায়।",
  "A planner, not a ticket number.": "টিকিট নম্বর নয়, একজন প্ল্যানার।",
  "Every trip has one named Pegah planner you can call or message, from booking until you are home.":
    "প্রতিটি ভ্রমণে থাকেন নির্দিষ্ট একজন পেগাহ প্ল্যানার, বুকিং থেকে বাড়ি ফেরা পর্যন্ত যাঁকে ফোন বা মেসেজ করতে পারবেন।",
};

/** Bangla (or English) for one static content string. */
export function content(locale: Locale, text: string): string {
  return locale === "bn" ? (BN[text] ?? text) : text;
}

/** For client and server components that can use hooks. */
export function useContent(): (text: string) => string {
  const locale = useLocale() as Locale;
  return (text: string) => content(locale, text);
}
