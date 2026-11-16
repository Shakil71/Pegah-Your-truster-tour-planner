"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, buttonClass, cx } from "@pegah/ui";
import { ItemActions } from "@/components/item-actions";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime } from "@/lib/format";

type Message = Schemas["AdminContactListDto_Output"]["items"][number];
type Status = Message["status"];

const TOPIC: Record<Message["topic"], string> = {
  BOOKING: "New booking",
  RESERVATION: "Existing reservation",
  PACKAGE: "Package or offer",
  OTHER: "Other question",
};
const STATUS: Record<Status, { label: string; cls: string }> = {
  NEW: { label: "New", cls: "bg-warn-soft text-warn" },
  IN_PROGRESS: { label: "In progress", cls: "bg-info-soft text-ink" },
  CLOSED: { label: "Closed", cls: "bg-good-soft text-good" },
};

/** Contact messages: read, call or email, then move them through New → In progress → Closed. */
export function MessagesManager({ items, csrfToken }: { items: Message[]; csrfToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((m) => [m.id, m.staffNote ?? ""])),
  );

  async function setStatus(m: Message, status: Status) {
    setBusy(m.id);
    setError(null);
    const { error: problem, response } = await browserApi.PUT(
      "/api/v1/admin/contact-messages/{id}",
      {
        params: { path: { id: m.id } },
        headers: csrf(csrfToken),
        body: { status, staffNote: (notes[m.id] ?? "").trim() },
      },
    );
    setBusy(null);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="panel p-8 text-center text-ink-2">No messages here.</p>;
  }

  return (
    <div className="grid gap-3">
      {error && <FormAlert>{error}</FormAlert>}
      <ul className="grid gap-3">
        {items.map((m) => (
          <li key={m.id} className="panel grid gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="tabular font-semibold">{m.reference}</span>
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-0.5 text-[0.74rem] font-semibold",
                      STATUS[m.status].cls,
                    )}
                  >
                    {STATUS[m.status].label}
                  </span>
                  <span className="rounded-full border border-rule px-2.5 py-0.5 text-[0.74rem] text-ink-2">
                    {TOPIC[m.topic]}
                  </span>
                  {m.signedIn && (
                    <span className="text-[0.74rem] text-ink-3">· signed-in customer</span>
                  )}
                </p>
                <p className="mt-1 text-[1.02rem] font-semibold">{m.name}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.86rem]">
                  <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1">
                    <Icon name="chat" className="size-4" /> {m.phone}
                  </a>
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.reference}`)}`}
                    className="inline-flex items-center gap-1 break-all"
                  >
                    <Icon name="doc" className="size-4" /> {m.email}
                  </a>
                </p>
              </div>
              <p className="text-right text-[0.8rem] text-ink-3">
                {dhakaDateTime(m.createdAt)}
                {(m.travelDate || m.guests) && (
                  <span className="mt-1 block text-ink-2">
                    {m.travelDate && <>Travel {m.travelDate}</>}
                    {m.travelDate && m.guests ? " · " : ""}
                    {m.guests ? `${m.guests} guests` : ""}
                  </span>
                )}
              </p>
            </div>

            <p className="whitespace-pre-line rounded-[12px] bg-paper-2 px-4 py-3 text-[0.92rem] text-ink">
              {m.message}
            </p>

            <div className="grid gap-2">
              <label htmlFor={`note-${m.id}`} className="text-[0.8rem] font-semibold text-ink-2">
                Staff note (only staff see it)
              </label>
              <textarea
                id={`note-${m.id}`}
                rows={2}
                maxLength={1000}
                value={notes[m.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })}
                placeholder="Called back, sent prices, booked as PG-…"
                className="rounded-control border border-rule bg-card px-3 py-2 text-[0.9rem] outline-none focus:border-ink"
              />
              <div className="flex flex-wrap items-center gap-2">
                {(["NEW", "IN_PROGRESS", "CLOSED"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => setStatus(m, s)}
                    className={buttonClass(m.status === s ? "primary" : "outline", "sm")}
                  >
                    {m.status === s
                      ? `Save note · ${STATUS[s].label}`
                      : `Mark ${STATUS[s].label.toLowerCase()}`}
                  </button>
                ))}
                {m.handledBy && m.handledAt && (
                  <span className="text-[0.76rem] text-ink-3">
                    Last updated by {m.handledBy}, {dhakaDateTime(m.handledAt)}
                  </span>
                )}
                <ItemActions
                  kind="contact-message"
                  itemKey={m.id}
                  name={`message ${m.reference}`}
                  csrfToken={csrfToken}
                  className="ml-auto"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
