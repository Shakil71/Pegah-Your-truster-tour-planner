import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { MessagesManager } from "./messages-manager";

export const metadata: Metadata = { title: "Contact messages" };

const STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;
type Status = (typeof STATUSES)[number];
const LABEL: Record<Status, string> = { NEW: "New", IN_PROGRESS: "In progress", CLOSED: "Closed" };

type Search = { status?: string; q?: string; cursor?: string };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("service:manage")) {
    return <NoAccess what="contact messages" permission="service:manage" />;
  }
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/contact-messages", {
      params: {
        query: { status, q, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 30 },
      },
    }),
  );
  const href = (s?: Status) => {
    const p = new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) });
    return `/messages${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Services"
        title="Contact messages"
        intro="Questions sent from the website's contact form: new bookings, existing reservations, packages and anything else. Reply by phone or email, then update the status. A message never holds or confirms a booking."
      />

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        <Link
          href={href()}
          aria-current={!status ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${!status ? "border-ink bg-ink text-card" : "border-rule text-ink-2 hover:border-ink"}`}
        >
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={href(s)}
            aria-current={status === s ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold no-underline ${status === s ? "border-ink bg-ink text-card" : "border-rule text-ink-2 hover:border-ink"}`}
          >
            {LABEL[s]} <span className="tabular opacity-70">{page.counts[s]}</span>
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap gap-2" role="search">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="msg-q" className="sr-only">
          Search messages
        </label>
        <input
          id="msg-q"
          name="q"
          defaultValue={q}
          placeholder="Reference, name, phone or email"
          className="h-10 min-w-[260px] flex-1 rounded-control border border-rule bg-card px-3 text-[0.9rem]"
        />
        <button
          type="submit"
          className="h-10 rounded-control border border-rule px-4 text-[0.86rem] font-semibold hover:border-ink"
        >
          Search
        </button>
      </form>

      <MessagesManager items={page.items} csrfToken={session.csrfToken} />

      {page.nextCursor && (
        <Link
          href={`/messages?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), cursor: page.nextCursor })}`}
          className="justify-self-end text-[0.84rem] font-semibold text-primary-ink hover:underline"
        >
          Older messages →
        </Link>
      )}
    </div>
  );
}
