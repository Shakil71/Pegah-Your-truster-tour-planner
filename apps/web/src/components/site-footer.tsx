import { Logo } from "@pegah/ui";
import { photoCredits } from "@/data/home";

const columns = [
  { title: "Travel", links: ["Stays", "Tours", "Destinations", "Flights (soon)", "Visa (soon)"] },
  {
    title: "Help",
    links: [
      "Manage a booking",
      "Cancellations and refunds",
      "Payment methods",
      "Contact a planner",
    ],
  },
  {
    title: "Pegah",
    links: ["About", "For hotels and operators", "For travel agents", "Terms and privacy"],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-night px-[max(16px,env(safe-area-inset-left,0px))] pb-8 pt-[72px] text-[#e7e9f4]">
      <div className="mx-auto max-w-[1280px]">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-1">
            <Logo className="text-[2.4rem]" />
            <p className="mt-3.5 max-w-[34ch] opacity-80">
              Stays, tours and travel planning across Bangladesh.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Planned payment methods">
              {["Visa", "Mastercard", "bKash", "Nagad"].map((p) => (
                <li
                  key={p}
                  className="rounded-md border border-white/25 px-2.5 py-1 text-[0.76rem] font-semibold"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="mb-3.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] opacity-65">
                {c.title}
              </h2>
              <ul className="grid gap-2 text-[0.92rem]">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="hover:underline">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <hr aria-hidden="true" className="stitch my-12 border-0" />
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 text-[0.8rem] opacity-70">
          <span>© 2026 Pegah. Prices in BDT.</span>
          <span>Design build · sample data · not a live booking site</span>
        </div>
        <details className="mt-[18px] text-[0.78rem] opacity-75">
          <summary className="cursor-pointer">Photo credits (Wikimedia Commons)</summary>
          <ul className="mt-2.5 grid gap-1 text-[0.76rem]">
            {photoCredits.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      </div>
    </footer>
  );
}
