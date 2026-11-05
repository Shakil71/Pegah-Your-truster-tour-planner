import { cx } from "./cx";

/**
 * The Pegah wordmark (owner-supplied artwork). `tone="light"` is the version
 * for dark surfaces (white plane); the default suits light surfaces. The
 * files live in the website's public folder and are served on the same origin
 * to the console. Size it with a height class, e.g. "h-10".
 */
export function Logo({
  className,
  tone = "dark",
  alt = "Pegah",
}: {
  className?: string;
  tone?: "dark" | "light";
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset shared by both apps
    <img
      src={tone === "light" ? "/brand/pegah-logo-light.webp" : "/brand/pegah-logo.webp"}
      alt={alt}
      width={537}
      height={240}
      decoding="async"
      className={cx("block h-10 w-auto select-none", className)}
    />
  );
}
