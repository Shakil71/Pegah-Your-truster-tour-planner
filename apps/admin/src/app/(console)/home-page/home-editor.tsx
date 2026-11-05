"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { HeroPicker } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Home = Schemas["AdminHomeSettingsDto_Output"];
type Option = { slug: string; label: string; published: boolean };

const LIMITS = { slides: 6, destinations: 8, hotels: 8, tours: 6 } as const;

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function Block({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="panel grid content-start gap-4 p-5 md:p-6">
      <div>
        <h2 className="text-[1rem] font-semibold">{title}</h2>
        <p className="mt-1 text-[0.84rem] text-ink-2">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function OrderButtons({
  onUp,
  onDown,
  onRemove,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onUp}
        className={buttonClass("ghost", "sm")}
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        className={buttonClass("ghost", "sm")}
        aria-label="Move down"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onRemove}
        className={buttonClass("ghost", "sm", "text-critical")}
      >
        Remove
      </button>
    </span>
  );
}

/** Pick catalog items in order: a checklist plus the ordered selection. */
function Featured({
  options,
  value,
  onChange,
  max,
  label,
}: {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  label: string;
}) {
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  const available = options.filter((o) => !value.includes(o.slug));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className="text-[0.8rem] font-semibold text-ink-2">
          Shown, in this order ({value.length}/{max})
        </p>
        {value.length === 0 ? (
          <p className="mt-2 text-[0.84rem] text-ink-3">
            None chosen: the built-in section is shown.
          </p>
        ) : (
          <ol className="mt-2 grid gap-1.5">
            {value.map((slug, i) => {
              const o = bySlug.get(slug);
              return (
                <li
                  key={slug}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-rule px-3 py-1.5 text-[0.86rem]"
                >
                  <span className={cx(!o?.published && "text-ink-3")}>
                    {o?.label ?? slug}
                    {o && !o.published && " (not published — hidden)"}
                  </span>
                  <OrderButtons
                    onUp={() => onChange(move(value, i, -1))}
                    onDown={() => onChange(move(value, i, 1))}
                    onRemove={() => onChange(value.filter((s) => s !== slug))}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div>
        <label className="text-[0.8rem] font-semibold text-ink-2">
          Add {label}
          <select
            value=""
            disabled={value.length >= max || available.length === 0}
            onChange={(e) => e.target.value && onChange([...value, e.target.value])}
            className="mt-2 h-11 w-full rounded-control border border-rule bg-card px-3 text-[0.9rem] font-normal"
          >
            <option value="">
              {value.length >= max ? `Limit of ${max} reached` : `Choose a ${label}…`}
            </option>
            {available.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
                {o.published ? "" : " (draft)"}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function HomeEditor({
  initial,
  csrfToken,
  mediaUrls,
  destinations,
  hotels,
  tours,
}: {
  initial: Home;
  csrfToken: string;
  mediaUrls: Record<string, string>;
  destinations: Option[];
  hotels: Option[];
  tours: Option[];
}) {
  const router = useRouter();
  const [home, setHome] = useState<Home>(initial);
  const [urls, setUrls] = useState(mediaUrls);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const set = <K extends keyof Home>(key: K, value: Home[K]) =>
    setHome((h) => ({ ...h, [key]: value }));

  async function save() {
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.PUT("/api/v1/admin/home", {
      headers: csrf(csrfToken),
      body: home,
    });
    setBusy(false);
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setNote({ tone: "good", text: "Home page saved. The website shows it within a minute." });
    router.refresh();
  }

  const emptyPromise = { titleEn: "", titleBn: "", bodyEn: "", bodyBn: "" };

  return (
    <div className="grid gap-5">
      <Block
        title="Hero slides"
        intro="Large photos at the top of the home page, with the place name in English and Bangla. Up to six; leave empty for the built-in photos."
      >
        {home.slides.length > 0 && (
          <ol className="grid gap-3">
            {home.slides.map((s, i) => (
              <li
                key={`${s.media}-${i}`}
                className="grid gap-3 rounded-[12px] border border-rule p-3 md:grid-cols-[140px_1fr_1fr_auto] md:items-end"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
                <img
                  src={urls[s.media] ?? `/media/${s.media}`}
                  alt=""
                  className="aspect-[4/3] w-[140px] rounded-[8px] object-cover"
                />
                <TextField
                  label="Place (English)"
                  value={s.placeEn}
                  onChange={(e) =>
                    set(
                      "slides",
                      home.slides.map((x, j) => (j === i ? { ...x, placeEn: e.target.value } : x)),
                    )
                  }
                />
                <TextField
                  label="Place (Bangla)"
                  lang="bn"
                  value={s.placeBn}
                  onChange={(e) =>
                    set(
                      "slides",
                      home.slides.map((x, j) => (j === i ? { ...x, placeBn: e.target.value } : x)),
                    )
                  }
                />
                <OrderButtons
                  onUp={() => set("slides", move(home.slides, i, -1))}
                  onDown={() => set("slides", move(home.slides, i, 1))}
                  onRemove={() =>
                    set(
                      "slides",
                      home.slides.filter((_, j) => j !== i),
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
        {home.slides.length < LIMITS.slides && (
          <HeroPicker
            value={null}
            csrfToken={csrfToken}
            onChange={(m) => {
              if (!m) return;
              setUrls((u) => ({ ...u, [m.key]: m.url }));
              set("slides", [...home.slides, { media: m.key, placeEn: "", placeBn: "" }]);
            }}
          />
        )}
      </Block>

      <Block
        title="Featured destinations"
        intro="The 'Where people are going' row. Each card links to that destination's stays."
      >
        <Featured
          options={destinations}
          value={home.featuredDestinations}
          onChange={(v) => set("featuredDestinations", v)}
          max={LIMITS.destinations}
          label="destination"
        />
      </Block>

      <Block
        title="Featured stays"
        intro="The 'Places to wake up in' section. Cards open the property with live prices."
      >
        <Featured
          options={hotels}
          value={home.featuredHotels}
          onChange={(v) => set("featuredHotels", v)}
          max={LIMITS.hotels}
          label="hotel"
        />
      </Block>

      <Block
        title="Featured tours"
        intro="The 'Trips we host' section, with each tour's next departure and price."
      >
        <Featured
          options={tours}
          value={home.featuredTours}
          onChange={(v) => set("featuredTours", v)}
          max={LIMITS.tours}
          label="tour"
        />
      </Block>

      <Block
        title="Our promises"
        intro="Up to three short promises in English and Bangla. Leave empty for the built-in three."
      >
        {home.promises.map((p, i) => (
          <div key={i} className="grid gap-3 rounded-[12px] border border-rule p-3 md:grid-cols-2">
            {(
              [
                ["titleEn", "Title (English)"],
                ["titleBn", "Title (Bangla)"],
                ["bodyEn", "Text (English)"],
                ["bodyBn", "Text (Bangla)"],
              ] as const
            ).map(([field, label]) => (
              <TextField
                key={field}
                label={label}
                lang={field.endsWith("Bn") ? "bn" : undefined}
                value={p[field]}
                maxLength={field.startsWith("title") ? 80 : 240}
                onChange={(e) =>
                  set(
                    "promises",
                    home.promises.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)),
                  )
                }
              />
            ))}
            <button
              type="button"
              onClick={() =>
                set(
                  "promises",
                  home.promises.filter((_, j) => j !== i),
                )
              }
              className={buttonClass("ghost", "sm", "justify-self-start text-critical")}
            >
              Remove promise
            </button>
          </div>
        ))}
        {home.promises.length < 3 && (
          <button
            type="button"
            onClick={() => set("promises", [...home.promises, emptyPromise])}
            className={buttonClass("outline", "sm", "justify-self-start")}
          >
            Add a promise
          </button>
        )}
      </Block>

      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <div className="sticky bottom-4 z-10 flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className={buttonClass("primary", "md", "shadow-lift")}
        >
          {busy ? "Saving…" : "Save home page"}
        </button>
      </div>
    </div>
  );
}
