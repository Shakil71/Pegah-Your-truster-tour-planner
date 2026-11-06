import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";
import { dhakaDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const FILTERS = [
  ["", "Everything"],
  ["booking.", "Bookings"],
  ["auth.", "Sign-ins"],
  ["staff.", "Staff changes"],
  ["user.", "Operator CLI"],
] as const;

type Search = { action?: string; targetId?: string; cursor?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  if (!session.user.permissions.includes("audit:read")) {
    return <NoAccess what="the audit log" permission="audit:read" />;
  }
  const sp = await searchParams;
  const action = FILTERS.some(([v]) => v === sp.action) ? sp.action : "";
  const api = await serverApi();
  const page = ensure(
    await api.GET("/api/v1/admin/audit", {
      params: {
        query: {
          action: action || undefined,
          targetId: sp.targetId?.slice(0, 40) || undefined,
          cursor: sp.cursor?.slice(0, 200) || undefined,
          limit: 50,
        },
      },
    }),
  );
  const qs = (extra: Record<string, string>) =>
    `/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...extra })}`;

  return (
    <div className="mx-auto grid max-w-[1440px] gap-6">
      <div className="animate-rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
          System
        </p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3vw,2.5rem)] font-medium leading-tight">
          Audit log
        </h1>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Append-only record of sensitive actions: sign-ins, staff changes, bookings and status
          changes. Nothing here can be edited or deleted.
        </p>
      </div>

      <section className="panel overflow-hidden" aria-label="Audit events">
        <nav
          className="flex flex-wrap gap-2 border-b border-rule px-4 py-3 md:px-6"
          aria-label="Filter"
        >
          {FILTERS.map(([value, label]) => (
            <Link
              key={label}
              href={value ? `/audit?action=${value}` : "/audit"}
              aria-current={action === value ? "page" : undefined}
              className={
                action === value
                  ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-[0.78rem] font-semibold text-on-primary"
                  : "rounded-full border border-rule px-3 py-1.5 text-[0.78rem] font-semibold text-ink-2 hover:border-ink hover:text-ink"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        {page.items.length === 0 ? (
          <p className="px-6 py-14 text-center text-ink-2">No events recorded yet.</p>
        ) : (
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Table, scrolls sideways"
          >
            <table className="w-full min-w-[860px] text-left text-[0.84rem]">
              <caption className="sr-only">Audit events, newest first</caption>
              <thead>
                <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    When (Dhaka)
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Actor
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Target
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((e) => (
                  <tr key={e.id} className="border-t border-rule align-top">
                    <td className="tabular whitespace-nowrap px-4 py-3">{dhakaDateTime(e.at)}</td>
                    <td className="px-4 py-3 font-semibold">{e.action}</td>
                    <td className="px-4 py-3">
                      {e.actorName ?? e.actorType.toLowerCase()}
                      {e.actorEmail && <p className="text-[0.74rem] text-ink-3">{e.actorEmail}</p>}
                      {e.ipAddress && (
                        <p className="tabular text-[0.72rem] text-ink-3">{e.ipAddress}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.targetType === "booking" && e.targetId ? (
                        <Link
                          href={`/bookings/${e.targetId}`}
                          className="text-primary-ink hover:underline"
                        >
                          booking
                        </Link>
                      ) : (
                        <span>{e.targetType ?? "—"}</span>
                      )}
                      {e.targetId && (
                        <p className="tabular max-w-[180px] truncate text-[0.72rem] text-ink-3">
                          {e.targetId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.metadata ? (
                        <code className="block max-w-[420px] whitespace-pre-wrap break-words text-[0.74rem] text-ink-2">
                          {JSON.stringify(e.metadata)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-4 border-t border-rule px-4 py-3 text-[0.8rem] md:px-6">
          {sp.cursor && (
            <Link href={qs({})} className="font-semibold text-primary-ink hover:underline">
              Newest
            </Link>
          )}
          {page.nextCursor && (
            <Link
              href={qs({ cursor: page.nextCursor })}
              className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline"
            >
              Older events <Icon name="arrowRight" className="size-4" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
