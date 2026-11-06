"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Schemas } from "@pegah/api-client";
import { CreateDestinationSchema } from "@pegah/contracts";
import {
  FormAlert,
  Icon,
  SelectField,
  TextAreaField,
  TextField,
  buttonClass,
  cx,
  zodResolver,
} from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { PublishPill } from "@/components/publish-pill";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Destination = Schemas["AdminDestination_Output"];
type Values = {
  slug: string;
  name: string;
  nameBn?: string | null;
  region: string;
  summary: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
  sortOrder: number;
};

const empty: Values = {
  slug: "",
  name: "",
  nameBn: "",
  region: "",
  summary: "",
  status: "DRAFT",
  sortOrder: 0,
};

export function DestinationManager({
  items,
  canManage,
  csrfToken,
}: {
  items: Destination[];
  canManage: boolean;
  csrfToken: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [hero, setHero] = useState<HeroRef | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(CreateDestinationSchema),
    defaultValues: empty,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  function edit(d: Destination | null) {
    setMessage(null);
    setEditing(d?.slug ?? null);
    setHero(d?.hero ?? null);
    reset(
      d
        ? {
            slug: d.slug,
            name: d.name,
            nameBn: d.nameBn ?? "",
            region: d.region,
            summary: d.summary,
            status: d.status,
            sortOrder: d.sortOrder,
          }
        : empty,
    );
  }

  async function save(values: Values) {
    setMessage(null);
    const { slug: _slug, ...rest } = values;
    void _slug;
    const result = editing
      ? await browserApi.PUT("/api/v1/admin/destinations/{slug}", {
          params: { path: { slug: editing } },
          headers: csrf(csrfToken),
          body: { ...rest, heroMedia: hero?.key ?? null },
        })
      : await browserApi.POST("/api/v1/admin/destinations", {
          headers: csrf(csrfToken),
          body: { ...values, heroMedia: hero?.key ?? null },
        });
    if (!result.response.ok) {
      setMessage({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    setMessage({ tone: "good", text: `${values.name} saved.` });
    if (!editing) edit(null);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="panel overflow-hidden" aria-label="Destinations">
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Table, scrolls sideways"
        >
          <table className="w-full min-w-[640px] text-left text-[0.86rem]">
            <thead>
              <tr className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-3">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Destination
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Hotels
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tours
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr
                  key={d.slug}
                  className={cx("border-t border-rule", editing === d.slug && "bg-primary-soft")}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-[0.76rem] text-ink-3">
                      {d.region} · /{d.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <PublishPill status={d.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href="/catalog/hotels" className="hover:underline">
                      {d.hotelCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href="/catalog/tours" className="hover:underline">
                      {d.tourCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => edit(d)}
                        className="text-[0.82rem] font-semibold text-primary-ink hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && (
        <form
          onSubmit={handleSubmit(save)}
          className="panel grid content-start gap-4 p-5 md:p-6"
          noValidate
        >
          <HeroPicker value={hero} onChange={setHero} csrfToken={csrfToken} />
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              <Icon name={editing ? "settings" : "plus"} className="size-4" />
              {editing ? "Edit destination" : "New destination"}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={() => edit(null)}
                className="text-[0.82rem] font-semibold text-ink-2 hover:text-ink"
              >
                New instead
              </button>
            )}
          </div>
          <TextField
            label="URL slug"
            disabled={editing !== null}
            hint={
              editing
                ? "Fixed after creation so links never break."
                : "Lowercase words joined by hyphens, e.g. coxs-bazar."
            }
            error={errors.slug?.message}
            {...register("slug")}
          />
          <TextField label="Name" error={errors.name?.message} {...register("name")} />
          <TextField
            label="Name in Bangla (optional)"
            lang="bn"
            error={errors.nameBn?.message}
            {...register("nameBn")}
          />
          <TextField
            label="Region / division"
            error={errors.region?.message}
            {...register("region")}
          />
          <TextAreaField label="Summary" error={errors.summary?.message} {...register("summary")} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Status" {...register("status")}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Live on site</option>
              <option value="SUSPENDED">Suspended</option>
            </SelectField>
            <TextField
              label="Sort order"
              type="number"
              error={errors.sortOrder?.message}
              {...register("sortOrder", { valueAsNumber: true })}
            />
          </div>
          {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
          <button type="submit" disabled={isSubmitting} className={buttonClass("primary", "md")}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create destination"}
          </button>
        </form>
      )}
    </div>
  );
}
