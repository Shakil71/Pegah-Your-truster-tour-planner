import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk, Noto_Serif_Bengali } from "next/font/google";
import "./globals.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--pg-font-display",
  display: "swap",
});
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--pg-font-text", display: "swap" });
const bengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  weight: "500",
  variable: "--pg-font-bn",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pegah — Stays and tours across Bangladesh", template: "%s · Pegah" },
  description:
    "Book tea-country bungalows, Sundarbans launches and haor houseboats. Prices in taka, confirmed by your host.",
};

export const viewport: Viewport = {
  themeColor: "#0f1330",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${bengali.variable}`}>
      <body>{children}</body>
    </html>
  );
}
