import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import { AdminShell } from "@/components/admin-shell";
import "./globals.css";

const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--pg-font-display",
  display: "swap",
});
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--pg-font-text", display: "swap" });

/** Staff views are always rendered per request (dates, and later auth). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Dashboard · Pegah Admin", template: "%s · Pegah Admin" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>
        <AdminShell today={today}>{children}</AdminShell>
      </body>
    </html>
  );
}
