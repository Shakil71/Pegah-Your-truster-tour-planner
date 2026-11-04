"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass, cx } from "@pegah/ui";
import { PublishPill } from "@/components/publish-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { timeAgo } from "@/lib/format";

type Page = Schemas["ContentPageDto_Output"];
type ListItem = Schemas["ContentPageListDto_Output"]["items"][number];

export function ContentEditor({
  pages,
  current,
  newSlug,
  missing,
  csrfToken,
}: {
  pages: ListItem[];
  current: Page | null;
  newSlug: string | null;
  missing: string[];
  csrfToken: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(current?.slug ?? newSlug ?? "");
  const [title, setTitle] = useState(current?.title ?? "");
  const [summary, setSummary] = useState(current?.summary ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [status, setStatus] = useState<Page["status"]>(current?.status ?? "DRAFT");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const input = { title, summary, body, status };
    const result = current
      ? await browserApi.PUT("/api/v1/admin/pages/{slug}", {
          params: { path: { slug: current.slug } },
          headers: csrf(csrfToken),
          body: input,
        })
      : await browserApi.POST("/api/v1/admin/pages", {
          headers: csrf(csrfToken),
          body: { ...input, slug },
        });
    setBusy(false);
    if (!result.response.ok) {
      setMessage({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setMessage({
      tone: "good",
      text: status === "PUBLISHED" ? "Saved and live on the website." : "Saved as draft.",
    });
    router.replace(`/content?slug=${current?.slug ?? slug}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav aria-label="Pages" className="panel h-fit p-3">
        <ul className="grid gap-1">
          {pages.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/content?slug=${p.slug}`}
                aria-current={current?.slug === p.slug ? "page" : undefined}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-[0.86rem]",
                  current?.slug === p.slug ? "bg-primary-soft font-semibold" : "hover:bg-paper",
                )}
              >
                <span className="truncate">{p.title}</span>
                <span className="text-[0.7rem] text-ink-3">{timeAgo(p.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {missing.length > 0 && (
          <div className="mt-3 border-t border-rule pt-3">
            <p className="px-3 text-[0.72rem] font-bold uppercase tracking-[0.1em] text-ink-3">
              Linked from the footer, not written yet
            </p>
            <ul className="mt-1 grid gap-1">
              {missing.map((s) => (
                <li key={s}>
                  <Link
                    href={`/content?slug=${s}`}
                    className="block rounded-[10px] px-3 py-1.5 text-[0.84rem] text-primary-ink hover:bg-paper"
                  >
                    + /{s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <form onSubmit={save} className="panel grid gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.95rem] font-semibold">
            {current ? `Edit /pages/${current.slug}` : "New page"}
          </h2>
          {current && <PublishPill status={current.status} />}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="URL slug"
            disabled={!!current}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            hint={`Shown at /pages/${slug || "…"}`}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Page["status"])}
          >
            <option value="DRAFT">Draft (hidden)</option>
            <option value="PUBLISHED">Live on site</option>
            <option value="SUSPENDED">Hidden</option>
          </SelectField>
        </div>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField
          label="Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          hint="One sentence under the title and in search results."
        />
        <TextAreaField
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="[&_textarea]:min-h-[360px] [&_textarea]:font-mono [&_textarea]:text-[0.88rem]"
        />
        {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className={buttonClass("primary", "md")}>
            {busy ? "Saving…" : "Save page"}
          </button>
          {current?.status === "PUBLISHED" && (
            // The public site lives outside the /admin basePath.
            <a
              href={`/pages/${current.slug}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("outline", "md")}
            >
              View on website
            </a>
          )}
        </div>
      </form>
    </div>
  );
}
