import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Icon, cx } from "@pegah/ui";
import { serverApi } from "@/lib/api-server";

/** The site-wide announcement set in the console (ADR-0029), in the visitor's language. */
export async function SiteNotice({ className }: { className?: string }) {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/site");
  const a = data?.announcement;
  if (!a) return null;
  const locale = await getLocale();
  const text = locale === "bn" ? a.textBn : a.textEn;
  const body = (
    <>
      <Icon name={a.tone === "warning" ? "alert" : "bell"} className="size-4 shrink-0" />
      <span>{text}</span>
      {a.linkHref && <Icon name="arrowRight" className="size-4 shrink-0" />}
    </>
  );
  const cls = cx(
    "flex items-center gap-2 rounded-[12px] px-4 py-2.5 text-[0.9rem] font-semibold no-underline",
    a.tone === "warning" ? "bg-warn-soft text-warn" : "bg-info-soft text-info",
    className,
  );
  return a.linkHref ? (
    <Link href={a.linkHref} className={cls} role="status">
      {body}
    </Link>
  ) : (
    <p className={cls} role="status">
      {body}
    </p>
  );
}
