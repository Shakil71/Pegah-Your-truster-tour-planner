import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { DesignsManager } from "./designs-manager";
import { GiftCardsManager } from "./gift-cards-manager";

export const metadata: Metadata = { title: "Gift cards" };

type Search = { q?: string; cursor?: string };

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("payment:read")) {
    return <NoAccess what="gift cards" permission="payment:read" />;
  }
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const api = await serverApi();
  const canDesign = session.user.permissions.includes("promotion:manage");
  const designs = canDesign ? ensure(await api.GET("/api/v1/admin/gift-card-designs")) : null;
  const page = ensure(
    await api.GET("/api/v1/admin/gift-cards", {
      params: { query: { q, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 30 } },
    }),
  );
  return (
    <div className="mx-auto grid max-w-[1300px] gap-6">
      <PageHeader
        eyebrow="Growth"
        title="Gift cards"
        intro="Design the cards customers can buy, and see every card issued. Cards bought on the website are issued automatically once paid, and the code is emailed to the recipient."
      />
      {designs && <DesignsManager items={designs.items} csrfToken={session.csrfToken} />}
      <h2 className="mt-4 text-[1.1rem] font-semibold">Issued cards</h2>
      <form className="flex flex-wrap gap-2" role="search">
        <label htmlFor="gc-q" className="sr-only">
          Search gift cards
        </label>
        <input
          id="gc-q"
          name="q"
          defaultValue={q}
          placeholder="Last 4 characters, recipient name or email"
          className="h-10 min-w-[260px] flex-1 rounded-control border border-rule bg-card px-3 text-[0.9rem]"
        />
        <button
          type="submit"
          className="h-10 rounded-control border border-rule px-4 text-[0.86rem] font-semibold hover:border-ink"
        >
          Search
        </button>
        {q && (
          <Link
            href="/gift-cards"
            className="grid h-10 place-items-center px-2 text-[0.86rem] font-semibold text-ink-2 hover:text-ink"
          >
            Clear
          </Link>
        )}
      </form>
      <GiftCardsManager
        items={page.items}
        csrfToken={session.csrfToken}
        canManage={session.user.permissions.includes("order:manage")}
      />
      {page.nextCursor && (
        <Link
          href={`/gift-cards?${new URLSearchParams({ ...(q ? { q } : {}), cursor: page.nextCursor })}`}
          className="justify-self-end text-[0.84rem] font-semibold text-primary-ink hover:underline"
        >
          Older cards →
        </Link>
      )}
    </div>
  );
}
