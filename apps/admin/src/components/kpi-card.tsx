import { Icon, cx } from "@pegah/ui";
import { takaCompact } from "@pegah/shared";

type Props = {
  label: string;
  value: number;
  format: "money" | "count" | "percent";
  delta: number;
  spark: number[];
  hint: string;
  /** True when a decrease is good news (e.g. refunds pending). */
  invert?: boolean;
  index: number;
};

function Sparkline({ data }: { data: number[] }) {
  const w = 120,
    h = 40,
    pad = 4;
  const min = Math.min(...data),
    max = Math.max(...data);
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = data.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-[120px] overflow-visible" aria-hidden="true">
      <path d={`${line}L${x(last)},${h}L${x(0)},${h}Z`} fill="var(--pg-primary)" opacity="0.12" />
      <path
        d={line}
        fill="none"
        stroke="var(--pg-primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(last)}
        cy={y(data[last] ?? 0)}
        r="3.5"
        fill="var(--pg-primary)"
        stroke="var(--pg-card)"
        strokeWidth="2"
      />
    </svg>
  );
}

export function KpiCard({ label, value, format, delta, spark, hint, invert, index }: Props) {
  const good = invert ? delta < 0 : delta > 0;
  const shown =
    format === "money"
      ? takaCompact(value)
      : format === "percent"
        ? `${value}%`
        : value.toLocaleString("en-IN");
  return (
    <article
      className="panel animate-rise relative overflow-hidden p-5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="text-[0.8rem] font-semibold text-ink-2">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="tabular font-display text-[2.3rem] font-medium leading-none tracking-[-0.02em]">
          {shown}
        </p>
        <Sparkline data={spark} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-[0.78rem]">
        <span
          className={cx(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold",
            good ? "bg-good-soft text-good" : "bg-critical-soft text-critical",
          )}
        >
          <Icon name={delta >= 0 ? "trendUp" : "trendDown"} className="size-3.5" />
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
        <span className="text-ink-3">{hint} vs previous</span>
      </p>
    </article>
  );
}
