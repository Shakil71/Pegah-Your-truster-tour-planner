"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState, type ReactNode } from "react";
import { dhakaDate } from "@pegah/shared";
import { Icon, buttonClass, type IconName } from "@pegah/ui";
import { places, quickPicks, trust } from "@/data/home";

/** Dates are plain calendar days; UTC arithmetic avoids DST and zone drift. */
function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function parse(s: string) {
  return new Date(`${s}T00:00:00Z`);
}
function dhakaToday() {
  const { year, month, day } = dhakaDate();
  return new Date(Date.UTC(year, month, day));
}
/** Next Thursday (Bangladesh's weekend starts Friday), two nights. */
function defaultDates() {
  const today = dhakaToday();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() + ((11 - start.getUTCDay()) % 7 || 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 2);
  return { today: iso(today), checkIn: iso(start), checkOut: iso(end) };
}

function Field({
  icon,
  label,
  htmlFor,
  wide,
  children,
}: {
  icon: IconName;
  label: string;
  htmlFor?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative flex min-w-0 items-center gap-3 rounded-control border-[1.5px] border-rule bg-card px-4 py-2.5 transition-colors focus-within:border-ink hover:border-ink ${wide ? "col-span-2 lg:col-span-1" : ""}`}
    >
      <Icon name={icon} className="text-primary-ink" />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={htmlFor}
          className="block text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-2"
        >
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

const inputClass = "w-full border-0 bg-transparent p-0 text-base font-semibold outline-none";
const limits = { adults: [1, 16], children: [0, 10], rooms: [1, 8] } as const;
type GuestKey = keyof typeof limits;

const tabClass =
  "relative inline-flex cursor-pointer items-center gap-2 rounded-t-control px-4 pb-3.5 pt-3 text-[0.95rem] font-semibold text-ink-2 hover:text-ink data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-4 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:content-[''] data-[state=active]:after:stitch-x";

export function SearchPanel() {
  const initial = useMemo(() => defaultDates(), []);
  const [where, setWhere] = useState("Srimangal, Sylhet");
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [guests, setGuests] = useState({ adults: 2, children: 0, rooms: 1 });
  const [tourWhere, setTourWhere] = useState("Sundarbans");
  const [tourStyle, setTourStyle] = useState("Any style");
  const [status, setStatus] = useState("");

  const months = useMemo(() => {
    const { year, month } = dhakaDate();
    return Array.from({ length: 6 }, (_, m) =>
      new Date(Date.UTC(year, month + m, 1)).toLocaleString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    );
  }, []);

  const guestLabel = `${guests.adults} ${guests.adults === 1 ? "adult" : "adults"}${
    guests.children ? `, ${guests.children} ${guests.children === 1 ? "child" : "children"}` : ""
  } · ${guests.rooms} ${guests.rooms === 1 ? "room" : "rooms"}`;

  function bump(key: GuestKey, delta: number) {
    setGuests((g) => {
      const [min, max] = limits[key];
      const next = { ...g, [key]: Math.min(max, Math.max(min, g[key] + delta)) };
      if (next.rooms > next.adults) next.rooms = next.adults;
      return next;
    });
  }

  function onCheckIn(v: string) {
    setCheckIn(v);
    if (checkOut <= v) {
      const d = parse(v);
      d.setUTCDate(d.getUTCDate() + 1);
      setCheckOut(iso(d));
    }
  }

  const nights = Math.round((parse(checkOut).getTime() - parse(checkIn).getTime()) / 864e5);

  return (
    <div className="relative z-10 mx-auto -mt-10 max-w-[1280px] md:-mt-24">
      <Tabs.Root defaultValue="stays" className="rounded-card bg-card shadow-lift">
        <Tabs.List
          aria-label="What are you booking?"
          className="flex flex-wrap gap-1 px-3.5 pt-2.5"
        >
          <Tabs.Trigger value="stays" className={tabClass}>
            <Icon name="bed" />
            Stays
          </Tabs.Trigger>
          <Tabs.Trigger value="tours" className={tabClass}>
            <Icon name="boat" />
            Tours
          </Tabs.Trigger>
          <Tabs.Trigger value="flights" className={tabClass}>
            <Icon name="plane" />
            Flights
            <small className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-thread">
              soon
            </small>
          </Tabs.Trigger>
          <Tabs.Trigger value="visa" className={tabClass}>
            <Icon name="doc" />
            Visa
            <small className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-thread">
              soon
            </small>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="stays">
          <form
            className="grid grid-cols-2 gap-2.5 border-t border-rule p-3.5 lg:grid-cols-[2fr_1.1fr_1.1fr_1.3fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              setStatus(
                `Prototype: the live site would show stays in ${where} for ${nights} ${nights === 1 ? "night" : "nights"} with live prices.`,
              );
            }}
          >
            <Field icon="pin" label="Where to?" htmlFor="q-where" wide>
              <input
                id="q-where"
                list="pg-places"
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field icon="calendar" label="Check-in" htmlFor="q-in">
              <input
                id="q-in"
                type="date"
                value={checkIn}
                min={initial.today}
                onChange={(e) => onCheckIn(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field icon="calendar" label="Check-out" htmlFor="q-out">
              <input
                id="q-out"
                type="date"
                value={checkOut}
                min={checkIn}
                onChange={(e) => setCheckOut(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field icon="user" label="Guests" htmlFor="q-guests">
              <Popover.Root>
                <Popover.Trigger
                  id="q-guests"
                  className={`${inputClass} cursor-pointer truncate text-left`}
                >
                  {guestLabel}
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={12}
                    className="z-50 grid w-[290px] gap-4 rounded-control border border-rule bg-card p-6 text-ink shadow-lift"
                  >
                    {(
                      [
                        ["adults", "Adults", "13 and over"],
                        ["children", "Children", "Under 13"],
                        ["rooms", "Rooms", ""],
                      ] as const
                    ).map(([key, label, hint]) => (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <span>
                          {label}
                          {hint && <small className="block text-[0.8rem] text-ink-2">{hint}</small>}
                        </span>
                        <span className="flex items-center gap-3">
                          <button
                            type="button"
                            aria-label={`Fewer ${label.toLowerCase()}`}
                            disabled={guests[key] <= limits[key][0]}
                            onClick={() => bump(key, -1)}
                            className="size-[34px] cursor-pointer rounded-full border-[1.5px] border-ink font-bold disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            −
                          </button>
                          <b className="tabular w-4 text-center">{guests[key]}</b>
                          <button
                            type="button"
                            aria-label={`More ${label.toLowerCase()}`}
                            disabled={guests[key] >= limits[key][1]}
                            onClick={() => bump(key, 1)}
                            className="size-[34px] cursor-pointer rounded-full border-[1.5px] border-ink font-bold disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            +
                          </button>
                        </span>
                      </div>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </Field>
            <button
              type="submit"
              className={buttonClass("primary", "lg", "col-span-2 lg:col-span-1")}
            >
              Search <Icon name="arrowRight" />
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2 px-3.5 pb-4 text-[0.86rem]">
            <span className="mr-1 text-ink-2">Popular:</span>
            {quickPicks.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setWhere(q.query)}
                className="cursor-pointer rounded-full border border-dashed border-ink-2 px-3 py-1 hover:border-solid hover:border-ink"
              >
                {q.label}
              </button>
            ))}
          </div>
        </Tabs.Content>

        <Tabs.Content value="tours">
          <form
            className="grid grid-cols-2 gap-2.5 border-t border-rule p-3.5 lg:grid-cols-[2fr_1.1fr_1.1fr_1.3fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              setStatus(
                `Prototype: the live site would list ${tourStyle.toLowerCase()} tours for ${tourWhere}.`,
              );
            }}
          >
            <Field icon="pin" label="Destination" htmlFor="t-where" wide>
              <input
                id="t-where"
                list="pg-places"
                value={tourWhere}
                onChange={(e) => setTourWhere(e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field icon="calendar" label="Month" htmlFor="t-month">
              <select id="t-month" className={inputClass}>
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field icon="users" label="Travellers" htmlFor="t-people">
              <select id="t-people" defaultValue="2" className={inputClass}>
                {["1", "2", "3", "4", "5", "6+"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field icon="boat" label="Style" htmlFor="t-kind">
              <select
                id="t-kind"
                value={tourStyle}
                onChange={(e) => setTourStyle(e.target.value)}
                className={inputClass}
              >
                {["Any style", "Houseboat", "Launch cruise", "Hill trek", "Heritage walk"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
            <button
              type="submit"
              className={buttonClass("primary", "lg", "col-span-2 lg:col-span-1")}
            >
              Find tours <Icon name="arrowRight" />
            </button>
          </form>
        </Tabs.Content>

        <Tabs.Content value="flights">
          <p className="m-0 border-t border-rule px-6 pb-6 pt-5 text-ink-2">
            Flight booking opens once our airline ticketing partner is live. We will only show fares
            we can actually issue.
          </p>
        </Tabs.Content>
        <Tabs.Content value="visa">
          <p className="m-0 border-t border-rule px-6 pb-6 pt-5 text-ink-2">
            Visa assistance is coming. You will be able to check requirements by country and track
            your application here.
          </p>
        </Tabs.Content>

        <datalist id="pg-places">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Tabs.Root>

      <p
        role="status"
        aria-live="polite"
        className="min-h-6 px-1.5 pt-2.5 text-[0.86rem] text-ink-2"
      >
        {status}
      </p>

      <ul className="grid grid-cols-1 gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        {trust.map((t) => (
          <li key={t.title} className="flex items-start gap-3 text-[0.9rem] text-ink-2">
            <Icon name={t.icon} className="mt-0.5 size-[26px] text-primary-ink" />
            <span>
              <b className="block font-semibold text-ink">{t.title}</b>
              {t.body}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
