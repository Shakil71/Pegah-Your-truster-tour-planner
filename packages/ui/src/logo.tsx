import { cx } from "./cx";

const DARK = "/brand/pegah-logo.webp";
const LIGHT = "/brand/pegah-logo-light.webp";

/**
 * The Pegah wordmark (owner-supplied artwork). `tone="light"` is the version
 * for dark surfaces (white plane), `tone="dark"` the one for light surfaces,
 * and the default `"auto"` follows the colour theme (theme surfaces such as
 * cards and the page). The files live in the website's public folder and are
 * served on the same origin to the console. Size it with a height class.
 */
export function Logo({
  className,
  tone = "auto",
  alt = "Pegah",
}: {
  className?: string;
  tone?: "auto" | "dark" | "light";
  alt?: string;
}) {
  const cls = cx("block h-10 w-auto select-none", className);
  if (tone !== "auto") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset shared by both apps
      <img
        src={tone === "light" ? LIGHT : DARK}
        alt={alt}
        width={537}
        height={240}
        decoding="async"
        className={cls}
      />
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset shared by both apps */}
      <img
        src={DARK}
        alt={alt}
        width={537}
        height={240}
        decoding="async"
        className={cx(cls, "dark:hidden")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static brand asset shared by both apps */}
      <img
        src={LIGHT}
        alt={alt}
        width={537}
        height={240}
        decoding="async"
        className={cx(cls, "hidden dark:block")}
      />
    </>
  );
}
