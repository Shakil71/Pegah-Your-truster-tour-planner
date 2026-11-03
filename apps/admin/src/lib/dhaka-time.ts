/** Calendar helpers pinned to Asia/Dhaka, independent of the server time zone. */
const TZ = "Asia/Dhaka";

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") };
}

export function dhakaToday(now = new Date()) {
  const { y, m, d, h } = parts(now);
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const local = new Date(`${iso}T00:00:00`);
  return { iso, hour: h, dow: local.getDay(), local };
}

export function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Short labels for the next `n` days starting today, e.g. "Wed 4". */
export function nextDays(local: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(local);
    d.setDate(local.getDate() + i);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
  });
}
