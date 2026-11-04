import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/shop/page-shell";
import { serverApi } from "@/lib/api-server";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const api = await serverApi();
  const { data } = await api.GET("/api/v1/pages/{slug}", { params: { path: { slug } } });
  return data ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load((await params).slug);
  return page ? { title: page.title, description: page.summary } : { title: "Not found" };
}

/**
 * Content pages edited in the admin. The body is plain text rendered as
 * paragraphs and headings by React (escaped), never injected as HTML.
 */
export default async function ContentPage({ params }: Props) {
  const page = await load((await params).slug);
  if (!page) notFound();
  const blocks = page.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <PageShell>
      <article className="mx-auto max-w-[760px]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          Pegah
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
          {page.title}
        </h1>
        <p className="mt-2 text-[1.05rem] text-ink-2">{page.summary}</p>
        <div className="mt-8 grid gap-4 text-[1rem] leading-relaxed">
          {blocks.map((b, i) =>
            b.startsWith("## ") ? (
              <h2 key={i} className="mt-4 font-display text-[1.5rem] font-medium">
                {b.slice(3)}
              </h2>
            ) : (
              <p key={i} className="whitespace-pre-line">
                {b}
              </p>
            ),
          )}
        </div>
        <p className="mt-10 text-[0.8rem] text-ink-3">
          Last updated{" "}
          {new Date(page.updatedAt).toLocaleDateString("en-GB", {
            timeZone: "Asia/Dhaka",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </article>
    </PageShell>
  );
}
