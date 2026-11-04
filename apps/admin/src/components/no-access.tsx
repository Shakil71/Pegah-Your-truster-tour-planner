import Link from "next/link";
import { Icon, buttonClass } from "@pegah/ui";

/** Shown when the signed-in role lacks a permission. The API refuses the data regardless. */
export function NoAccess({ what, permission }: { what: string; permission: string }) {
  return (
    <section className="panel mx-auto grid max-w-[720px] place-items-center px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-paper-2 text-ink-2">
        <Icon name="key" className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-[1.6rem] font-medium">No access to {what}</h1>
      <p className="mt-2 max-w-[48ch] text-ink-2">
        Your role does not include <code className="font-semibold">{permission}</code>. Ask an owner
        if you need it.
      </p>
      <Link href="/" className={buttonClass("ink", "md", "mt-6")}>
        Back to dashboard
      </Link>
    </section>
  );
}
