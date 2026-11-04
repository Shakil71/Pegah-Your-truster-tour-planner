import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icon";

const control =
  "h-12 w-full rounded-control border border-rule bg-card px-4 text-[0.95rem] outline-none transition-colors placeholder:text-ink-3 focus:border-ink aria-[invalid=true]:border-critical";

type FieldShell = { label: string; error?: string; hint?: string; className?: string };

function Shell({
  id,
  label,
  error,
  hint,
  className,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={cx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.84rem] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[0.8rem] text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[0.78rem] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Labelled input with error text wired to aria-describedby. Works with React Hook Form's register(). */
export function TextField({
  label,
  error,
  hint,
  className,
  ...input
}: FieldShell & ComponentPropsWithRef<"input">) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={control}
        {...input}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...select
}: FieldShell & ComponentPropsWithRef<"select">) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(control, "appearance-none")}
        {...select}
      >
        {children}
      </select>
    </Shell>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  className,
  ...area
}: FieldShell & ComponentPropsWithRef<"textarea">) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(control, "h-auto min-h-24 py-3")}
        {...area}
      />
    </Shell>
  );
}

/** Form-level message. `tone="critical"` for errors, `"good"` for success. */
export function FormAlert({
  children,
  tone = "critical",
}: {
  children: ReactNode;
  tone?: "critical" | "good" | "warn";
}) {
  const styles = {
    critical: "bg-critical-soft text-critical",
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
  } as const;
  return (
    <p
      role={tone === "critical" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-[0.86rem]",
        styles[tone],
      )}
    >
      <Icon name={tone === "good" ? "check" : "alert"} className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
