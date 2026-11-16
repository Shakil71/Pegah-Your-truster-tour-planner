"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ManagedKind } from "@pegah/contracts";
import { Icon, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/**
 * Show/hide on the website and delete, for any listing in the console.
 * `visible` omitted = delete only. Deleting asks first; items with bookings
 * or orders are refused by the server with a message to hide them instead.
 */
export function ItemActions({
  kind,
  itemKey,
  name,
  visible,
  csrfToken,
  afterDelete,
  compact = false,
  toggleOnly = false,
  className,
}: {
  kind: ManagedKind;
  /** Slug or public id, as the item's own console URL uses. */
  itemKey: string;
  /** Shown in the confirmation, e.g. the hotel name. */
  name: string;
  visible?: boolean;
  csrfToken: string;
  /** Where to go after deleting (e.g. back to the list from a detail page). */
  afterDelete?: string;
  compact?: boolean;
  /** Only the show/hide switch (the delete button sits elsewhere in the row). */
  toggleOnly?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(visible);
  const [busy, setBusy] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = { kind, key: itemKey };

  async function toggle() {
    if (shown === undefined) return;
    setBusy("toggle");
    setError(null);
    const res = await browserApi.PUT("/api/v1/admin/manage/{kind}/{key}/visibility", {
      params: { path },
      headers: csrf(csrfToken),
      body: { visible: !shown },
    });
    setBusy(null);
    if (!res.response.ok) {
      setError(problemMessage(res.error));
      return;
    }
    setShown(res.data?.visible ?? !shown);
    router.refresh();
  }

  async function remove() {
    if (
      !window.confirm(
        `Delete "${name}" permanently?\n\nThis cannot be undone. To take it off the website for now, choose Hide instead.`,
      )
    )
      return;
    setBusy("delete");
    setError(null);
    const res = await browserApi.DELETE("/api/v1/admin/manage/{kind}/{key}", {
      params: { path },
      headers: csrf(csrfToken),
    });
    setBusy(null);
    if (!res.response.ok) {
      setError(problemMessage(res.error));
      return;
    }
    if (afterDelete) router.push(afterDelete);
    router.refresh();
  }

  return (
    <div className={cx("grid justify-items-end gap-1.5", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {shown !== undefined && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy !== null}
            aria-pressed={shown}
            title={shown ? "Showing on the website. Click to hide." : "Hidden. Click to show."}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.78rem] font-semibold transition-colors disabled:opacity-60",
              shown
                ? "bg-good-soft text-good hover:bg-good-soft/70"
                : "bg-paper-2 text-ink-2 hover:bg-rule",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "relative inline-block h-4 w-7 rounded-full transition-colors",
                shown ? "bg-good" : "bg-ink-3",
              )}
            >
              <span
                className={cx(
                  "absolute top-0.5 size-3 rounded-full bg-card transition-all",
                  shown ? "left-3.5" : "left-0.5",
                )}
              />
            </span>
            {busy === "toggle" ? "Saving…" : shown ? "Showing" : "Hidden"}
          </button>
        )}
        {!toggleOnly && (
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            aria-label={`Delete ${name}`}
            className={buttonClass(
              "ghost",
              "sm",
              "text-critical hover:bg-critical-soft disabled:opacity-60",
            )}
          >
            <Icon name="x" className="size-4" />
            {!compact && (busy === "delete" ? "Deleting…" : "Delete")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-[320px] text-right text-[0.78rem] text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
