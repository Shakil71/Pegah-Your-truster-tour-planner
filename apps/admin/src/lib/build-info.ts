/**
 * Which commit this build came from. The deploy script sets these at build
 * time (NEXT_PUBLIC_* values are inlined by Next.js); local builds show "dev".
 */
const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

export const buildInfo = {
  sha: sha ? sha.slice(0, 7) : "dev",
  /** Build time shown in Asia/Dhaka, e.g. "4 Nov, 11:42". */
  builtAtLabel: builtAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(builtAt))
    : "local",
  commitUrl: sha
    ? `https://github.com/Shakil71/Pegah-Your-truster-tour-planner/commit/${sha}`
    : null,
};
