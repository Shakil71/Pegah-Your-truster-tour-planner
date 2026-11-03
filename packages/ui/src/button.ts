import { cx } from "./cx";

export type ButtonVariant = "primary" | "ink" | "outline" | "ghost" | "onPhoto";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,color,box-shadow,transform] duration-150 ease-pegah active:translate-y-px disabled:pointer-events-none disabled:opacity-40 cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-soft",
  ink: "bg-ink text-card hover:bg-primary hover:text-on-primary",
  outline: "border-[1.5px] border-current hover:bg-ink hover:text-card hover:border-ink",
  ghost: "hover:bg-paper-2",
  onPhoto: "border-[1.5px] border-white/70 text-white hover:bg-white hover:text-night",
};

const sizes = {
  sm: "h-9 px-4 text-sm rounded-control",
  md: "h-11 px-5 rounded-control",
  lg: "h-[62px] px-8 text-[1.02rem] rounded-control",
} as const;

/** Class string for buttons and button-styled links. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: keyof typeof sizes = "md",
  extra?: string,
): string {
  return cx(base, variants[variant], sizes[size], extra);
}
