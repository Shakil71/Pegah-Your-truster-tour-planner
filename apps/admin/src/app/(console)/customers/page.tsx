import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

type Search = { q?: string; cursor?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("customer:read")) {
    return <NoAccess what="customers" permission="customer:read" />;
  }
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/customers", {
      params: { query: { q, cursor: sp.cursor?.slice(0, 200) || undefined, limit: 30 } },
    }),
  );

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Customers"
        intro="Traveller accounts. Open one to see every booking they made and what they have spent."
      />
      <section className="panel overflow-hidden" aria-label="Customers">
        <form
          role="search"
          action="/admin/customers"
          className="flex gap-3 border-b border-rule p-4 md:px-6"
        >
          <label htmlFor="cust-q" className="sr-only">
            Search by email, name or phone
          </label>
          <input
            id="cust-q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            maxLength={80}
            placeholder="Email, name or phone — press Enter"
            className="h-11 flex-1 rounded-control border border-rule bg-paper px-4 text-[0.9rem] outline-none focus:border-ink"
          />
        </form>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">
            {q ? `No customers match “${q}”.` : "No customers yet."}
          </p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways"
          >
            <table className="w-full min-w-[760px] text-left text-[0.86rem]">
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Phone
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Bookings
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Last sign-in
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((c) => (
                  <tr key={c.id} className="border-t border-rule hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-semibold hover:underline">
                        {c.fullName}
                      </Link>
                      <p className="text-[0.76rem] text-ink-3">{c.email}</p>
                    </td>
                    <td className="tabular px-4 py-3">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">{c.bookingCount}</td>
                    <td className="px-4 py-3 text-ink-3">{timeAgo(c.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-3">
                      {c.lastLoginAt ? timeAgo(c.lastLoginAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.nextCursor && (
          <div className="flex justify-end border-t border-rule px-4 py-3 text-[0.8rem] md:px-6">
            <Link
              href={`/customers?${new URLSearchParams({ ...(q ? { q } : {}), cursor: page.nextCursor })}`}
              className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
            >
              More <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
