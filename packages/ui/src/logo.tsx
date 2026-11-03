import { cx } from "./cx";

/** Wordmark: Bodoni "Pegah" with a primary-orange full stop. */
export function Logo({ className, dotClassName }: { className?: string; dotClassName?: string }) {
  return (
    <span className={cx("font-display font-semibold leading-none tracking-[0.01em]", className)}>
      Pegah<span className={cx("text-primary", dotClassName)}>.</span>
    </span>
  );
}
