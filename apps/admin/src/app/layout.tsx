import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { savedTheme } from "@/lib/theme";
import "./globals.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--pg-font-display",
  display: "swap",
});
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--pg-font-text", display: "swap" });

/** Staff views are always rendered per request (session, live data). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Dashboard · Pegah Admin", template: "%s · Pegah Admin" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={await savedTheme()}
      className={`${display.variable} ${text.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
