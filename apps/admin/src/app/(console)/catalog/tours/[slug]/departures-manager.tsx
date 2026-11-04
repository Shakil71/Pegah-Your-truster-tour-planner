"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, TextField, buttonClass, cx } from "@pegah/ui";
import { PublishPill } from "@/components/publish-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { dhakaDateTime, money } from "@/lib/format";
import { parseTaka, takaText } from "@/lib/money-input";

type Departure = Schemas["AdminDeparture_Output"];

/** "2026-12-10" + "07:00" in Dhaka (UTC+6, no DST) → ISO instant. */
function dhakaInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+06:00`).toISOString();
}

/**
 * Departures of one tour. Capacity cannot go below seats held or sold, and a
 * departure with bookings can only be closed, not cancelled (API rules).
 */
export function DeparturesManager({
  tourSlug,
  departures,
  groupSizeMax,
  durationNights,
  canManage,
  csrfToken,
}: {
  tourSlug: string;
  departures: Departure[];
  groupSizeMax: number;
  durationNights: number;
  canManage: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    id: string;
    capacity: string;
    adult: string;
    child: string;
  } | null>(null);
  const [draft, setDraft] = useState({
    date: "",
    time: "07:00",
    returnDate: "",
    returnTime: "18:00",
    capacity: String(groupSizeMax),
    adult: "",
    child: "",
  });
  const [now] = useState(() => Date.now());

  async function patch(d: Departure, body: Record<string, unknown>, done: string) {
    setBusy(d.id);
    setMessage(null);
    const { error, response } = await browserApi.PATCH("/api/v1/admin/departures/{id}", {
      params: { path: { id: d.id } },
      headers: csrf(csrfToken),
      body,
    });
    setBusy(null);
    if (!response.ok) {
      setMessage({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setEdit(null);
    setMessage({ tone: "good", text: done });
    router.refresh();
  }

  async function saveEdit(d: Departure) {
    if (!edit) return;
    const adult = parseTaka(edit.adult);
    const child = parseTaka(edit.child);
    if (adult === null || child === null) {
      setMessage({ tone: "critical", text: "Enter prices in taka, e.g. 9000 or 9000.50." });
      return;
    }
    await patch(
      d,
      {
        capacity: Number(edit.capacity),
        priceAdult: { amountMinor: adult, currency: "BDT" },
        priceChild: { amountMinor: child, currency: "BDT" },
      },
      "Departure updated. New prices apply to new bookings only.",
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const adult = parseTaka(draft.adult);
    const child = draft.child.trim() ? parseTaka(draft.child) : 0;
    if (!draft.date || !draft.returnDate || adult === null || child === null) {
      setMessage({ tone: "critical", text: "Fill in dates and prices (taka)." });
      return;
    }
    setBusy("new");
    const { error, response } = await browserApi.POST("/api/v1/admin/tours/{slug}/departures", {
      params: { path: { slug: tourSlug } },
      headers: csrf(csrfToken),
      body: {
        departsAt: dhakaInstant(draft.date, draft.time),
        returnsAt: dhakaInstant(draft.returnDate, draft.returnTime),
        capacity: Number(draft.capacity),
        priceAdult: { amountMinor: adult, currency: "BDT" },
        priceChild: { amountMinor: child, currency: "BDT" },
      },
    });
    setBusy(null);
    if (!response.ok) {
      setMessage({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setMessage({ tone: "good", text: "Departure added and on sale." });
    setDraft((d) => ({ ...d, date: "", returnDate: "" }));
    router.refresh();
  }

  return (
    <section className="panel p-5 md:p-6" aria-labelledby="dep-h">
      <h2 id="dep-h" className="text-[0.95rem] font-semibold">
        Departures ({departures.length})
      </h2>
      <p className="mt-1 text-[0.78rem] text-ink-3">
        Times are Dhaka time. Held = in a 15-minute checkout; sold = confirmed.
      </p>
      {message && (
        <div className="mt-3">
          <FormAlert tone={message.tone}>{message.text}</FormAlert>
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-[0.84rem]">
          <thead>
            <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
              <th scope="col" className="px-3 py-2 font-semibold">
                Departs
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Seats
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Adult / child
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {departures.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-2">
                  No departures yet.
                </td>
              </tr>
            )}
            {departures.map((d) => {
              const past = Date.parse(d.departsAt) < now;
              const taken = d.held + d.sold;
              const editing = edit?.id === d.id;
              return (
                <tr
                  key={d.id}
                  className={cx("border-t border-rule align-top", past && "opacity-50")}
                >
                  <td className="px-3 py-3">
                    <p className="font-semibold">{dhakaDateTime(d.departsAt)}</p>
                    <p className="text-[0.74rem] text-ink-3">
                      returns {dhakaDateTime(d.returnsAt)}
                    </p>
                  </td>
                  <td className="tabular px-3 py-3">
                    {editing ? (
                      <input
                        aria-label="Capacity"
                        type="number"
                        min={taken}
                        value={edit.capacity}
                        onChange={(e) => setEdit({ ...edit, capacity: e.target.value })}
                        className="h-9 w-20 rounded-control border border-rule px-2"
                      />
                    ) : (
                      <>
                        <b>{taken}</b>/{d.capacity}
                        <p className="text-[0.74rem] text-ink-3">
                          {d.sold} sold · {d.held} held
                        </p>
                      </>
                    )}
                  </td>
                  <td className="tabular px-3 py-3">
                    {editing ? (
                      <span className="flex gap-1.5">
                        <input
                          aria-label="Adult price, taka"
                          value={edit.adult}
                          onChange={(e) => setEdit({ ...edit, adult: e.target.value })}
                          className="h-9 w-24 rounded-control border border-rule px-2"
                        />
                        <input
                          aria-label="Child price, taka"
                          value={edit.child}
                          onChange={(e) => setEdit({ ...edit, child: e.target.value })}
                          className="h-9 w-24 rounded-control border border-rule px-2"
                        />
                      </span>
                    ) : (
                      <>
                        {money(d.priceAdult)} / {money(d.priceChild)}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <PublishPill status={d.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canManage && !past && (
                      <span className="inline-flex flex-wrap justify-end gap-1.5">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              disabled={busy === d.id}
                              onClick={() => saveEdit(d)}
                              className={buttonClass("primary", "sm")}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEdit(null)}
                              className={buttonClass("ghost", "sm")}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {d.status !== "CANCELLED" && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEdit({
                                    id: d.id,
                                    capacity: String(d.capacity),
                                    adult: takaText(d.priceAdult),
                                    child: takaText(d.priceChild),
                                  })
                                }
                                className={buttonClass("ghost", "sm")}
                              >
                                Edit
                              </button>
                            )}
                            {d.status === "SCHEDULED" && (
                              <button
                                type="button"
                                disabled={busy === d.id}
                                onClick={() =>
                                  patch(d, { status: "CLOSED" }, "Sales closed for this departure.")
                                }
                                className={buttonClass("outline", "sm")}
                              >
                                Close sales
                              </button>
                            )}
                            {d.status === "CLOSED" && (
                              <button
                                type="button"
                                disabled={busy === d.id}
                                onClick={() => patch(d, { status: "SCHEDULED" }, "Back on sale.")}
                                className={buttonClass("outline", "sm")}
                              >
                                Reopen
                              </button>
                            )}
                            {d.status !== "CANCELLED" && taken === 0 && (
                              <button
                                type="button"
                                disabled={busy === d.id}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Cancel this departure? It disappears from the website.",
                                    )
                                  ) {
                                    void patch(d, { status: "CANCELLED" }, "Departure cancelled.");
                                  }
                                }}
                                className="h-9 rounded-control px-3 text-[0.82rem] font-semibold text-critical hover:bg-critical-soft"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form
          onSubmit={create}
          className="mt-5 grid gap-3 rounded-[14px] border border-dashed border-rule p-4 md:grid-cols-4"
        >
          <h3 className="flex items-center gap-2 text-[0.88rem] font-semibold md:col-span-4">
            <Icon name="plus" className="size-4" /> Add a departure
          </h3>
          <TextField
            label="Departure date"
            type="date"
            value={draft.date}
            onChange={(e) => {
              const date = e.target.value;
              const back = new Date(`${date}T00:00:00Z`);
              back.setUTCDate(back.getUTCDate() + durationNights);
              setDraft((d) => ({
                ...d,
                date,
                returnDate: date ? back.toISOString().slice(0, 10) : "",
              }));
            }}
          />
          <TextField
            label="Time"
            type="time"
            value={draft.time}
            onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
          />
          <TextField
            label="Return date"
            type="date"
            min={draft.date}
            value={draft.returnDate}
            onChange={(e) => setDraft((d) => ({ ...d, returnDate: e.target.value }))}
          />
          <TextField
            label="Return time"
            type="time"
            value={draft.returnTime}
            onChange={(e) => setDraft((d) => ({ ...d, returnTime: e.target.value }))}
          />
          <TextField
            label="Seats"
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))}
          />
          <TextField
            label="Adult price (৳)"
            inputMode="decimal"
            value={draft.adult}
            onChange={(e) => setDraft((d) => ({ ...d, adult: e.target.value }))}
          />
          <TextField
            label="Child price (৳)"
            inputMode="decimal"
            placeholder="0"
            value={draft.child}
            onChange={(e) => setDraft((d) => ({ ...d, child: e.target.value }))}
          />
          <button
            type="submit"
            disabled={busy === "new"}
            className={buttonClass("primary", "md", "self-end")}
          >
            {busy === "new" ? "Adding…" : "Add departure"}
          </button>
        </form>
      )}
    </section>
  );
}
