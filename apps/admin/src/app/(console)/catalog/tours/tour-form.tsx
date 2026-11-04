"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { bpsToPercent, percentToBps } from "@/lib/money-input";

type Tour = Schemas["AdminTourDetailDto_Output"];
type Values = {
  slug: string;
  destinationSlug: string;
  title: string;
  titleBn: string;
  summary: string;
  description: string;
  durationDays: string;
  durationNights: string;
  meetingPoint: string;
  groupSizeMax: string;
  highlights: string;
  includes: string;
  excludes: string;
  vat: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
};

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export function TourForm({
  tour,
  destinations,
  csrfToken,
  readOnly,
}: {
  tour?: Tour;
  destinations: { slug: string; name: string }[];
  csrfToken: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { register, handleSubmit, formState } = useForm<Values>({
    defaultValues: {
      slug: tour?.slug ?? "",
      destinationSlug: tour?.destination.slug ?? destinations[0]?.slug ?? "",
      title: tour?.title ?? "",
      titleBn: tour?.titleBn ?? "",
      summary: tour?.summary ?? "",
      description: tour?.description ?? "",
      durationDays: String(tour?.durationDays ?? 2),
      durationNights: String(tour?.durationNights ?? 1),
      meetingPoint: tour?.meetingPoint ?? "",
      groupSizeMax: String(tour?.groupSizeMax ?? 12),
      highlights: (tour?.highlights ?? []).join("\n"),
      includes: (tour?.includes ?? []).join("\n"),
      excludes: (tour?.excludes ?? []).join("\n"),
      vat: bpsToPercent(tour?.vatBps ?? 500),
      status: tour?.status ?? "DRAFT",
    },
  });

  async function save(v: Values) {
    setMessage(null);
    setFieldErrors({});
    const vat = percentToBps(v.vat);
    if (vat === null) {
      setFieldErrors({ vatBps: "Enter a percentage like 5" });
      return;
    }
    const body = {
      destinationSlug: v.destinationSlug,
      title: v.title,
      titleBn: v.titleBn,
      summary: v.summary,
      description: v.description,
      durationDays: Number(v.durationDays),
      durationNights: Number(v.durationNights),
      meetingPoint: v.meetingPoint,
      groupSizeMax: Number(v.groupSizeMax),
      highlights: lines(v.highlights),
      includes: lines(v.includes),
      excludes: lines(v.excludes),
      vatBps: vat,
      status: v.status,
    };
    const result = tour
      ? await browserApi.PUT("/api/v1/admin/tours/{slug}", {
          params: { path: { slug: tour.slug } },
          headers: csrf(csrfToken),
          body,
        })
      : await browserApi.POST("/api/v1/admin/tours", {
          headers: csrf(csrfToken),
          body: { ...body, slug: v.slug },
        });
    if (!result.response.ok) {
      const problem = result.error as { errors?: { path: string; message: string }[] } | undefined;
      setFieldErrors(
        Object.fromEntries((problem?.errors ?? []).map((e) => [e.path.split(".")[0]!, e.message])),
      );
      setMessage({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    if (!tour) {
      router.push(`/catalog/tours/${v.slug}`);
      return;
    }
    setMessage({ tone: "good", text: "Saved. The website updates within a few minutes." });
    router.refresh();
  }

  const err = (k: string) => fieldErrors[k];

  return (
    <form onSubmit={handleSubmit(save)} className="panel grid gap-4 p-5 md:p-6" noValidate>
      <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
        <TextField
          label="URL slug"
          disabled={!!tour || readOnly}
          hint={tour ? "Fixed after creation." : "e.g. sundarbans-river-cruise"}
          error={err("slug")}
          {...register("slug")}
        />
        <SelectField
          label="Destination"
          error={err("destinationSlug")}
          {...register("destinationSlug")}
        >
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Title" error={err("title")} {...register("title")} />
        <TextField
          label="Title in Bangla (optional)"
          lang="bn"
          error={err("titleBn")}
          {...register("titleBn")}
        />
        <TextAreaField
          label="Summary (shown in lists)"
          className="md:col-span-2"
          error={err("summary")}
          {...register("summary")}
        />
        <TextAreaField
          label="Itinerary / description"
          className="md:col-span-2"
          error={err("description")}
          {...register("description")}
        />
        <div className="grid grid-cols-3 gap-3 md:col-span-2">
          <TextField
            label="Days"
            type="number"
            error={err("durationDays")}
            {...register("durationDays")}
          />
          <TextField
            label="Nights"
            type="number"
            error={err("durationNights")}
            {...register("durationNights")}
          />
          <TextField
            label="Max group"
            type="number"
            error={err("groupSizeMax")}
            {...register("groupSizeMax")}
          />
        </div>
        <TextField
          label="Meeting point"
          error={err("meetingPoint")}
          {...register("meetingPoint")}
        />
        <TextField label="VAT %" inputMode="decimal" error={err("vatBps")} {...register("vat")} />
        <TextAreaField
          label="Highlights (one per line)"
          error={err("highlights")}
          {...register("highlights")}
        />
        <TextAreaField
          label="Included (one per line)"
          error={err("includes")}
          {...register("includes")}
        />
        <TextAreaField
          label="Not included (one per line)"
          error={err("excludes")}
          {...register("excludes")}
        />
        <SelectField label="Status" {...register("status")}>
          <option value="DRAFT">Draft (hidden)</option>
          <option value="PUBLISHED">Live on site</option>
          <option value="SUSPENDED">Suspended (hidden)</option>
        </SelectField>
      </fieldset>
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      {!readOnly && (
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className={buttonClass("primary", "md", "justify-self-start")}
        >
          {formState.isSubmitting ? "Saving…" : tour ? "Save tour" : "Create tour"}
        </button>
      )}
    </form>
  );
}
