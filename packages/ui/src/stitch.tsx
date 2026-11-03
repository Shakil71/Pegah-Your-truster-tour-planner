import { cx } from "./cx";

/** The running-stitch divider, Pegah's single ornament. Decorative only. */
export function Stitch({ className }: { className?: string }) {
  return <hr aria-hidden="true" className={cx("stitch border-0", className)} />;
}
