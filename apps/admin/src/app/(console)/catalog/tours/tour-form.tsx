"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass } from "@pegah/ui";
import { AmenityPicker, GalleryPicker } from "@/components/gallery-picker";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { money } from "@/lib/format";
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
  tourType: string;
  timing: string;
  overview: string;
  itinerary: string;
  transport: string;
  policy: string;
  cancellationPolicy: string;
  travelTips: string;
  additionalInfo: string;
  pickupPoints: string;
  tags: string;
  minAdults: string;
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
  const [hero, setHero] = useState<HeroRef | null>(tour?.hero ?? null);
  const [gallery, setGallery] = useState<HeroRef[]>(tour?.gallery ?? []);
  const [amenities, setAmenities] = useState<string[]>(tour?.amenities ?? []);
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
      tourType: tour?.tourType ?? "",
      timing: tour?.timing ?? "",
      overview: tour?.overview ?? "",
      itinerary: tour?.itinerary ?? "",
      transport: tour?.transport ?? "",
      policy: tour?.policy ?? "",
      cancellationPolicy: tour?.cancellationPolicy ?? "",
      travelTips: tour?.travelTips ?? "",
      additionalInfo: tour?.additionalInfo ?? "",
      pickupPoints: (tour?.pickupPoints ?? []).join("\n"),
      tags: (tour?.tags ?? []).join("\n"),
      minAdults: tour?.minAdults ? String(tour.minAdults) : "",
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
      heroMedia: hero?.key ?? null,
      tourType: v.tourType,
      timing: v.timing,
      overview: v.overview,
      itinerary: v.itinerary,
      transport: v.transport,
      policy: v.policy,
      cancellationPolicy: v.cancellationPolicy,
      travelTips: v.travelTips,
      additionalInfo: v.additionalInfo,
      pickupPoints: lines(v.pickupPoints),
      tags: lines(v.tags),
      minAdults: v.minAdults ? Number(v.minAdults) : null,
      gallery: gallery.map((g) => g.key),
      amenities,
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
      <HeroPicker value={hero} onChange={setHero} csrfToken={csrfToken} readOnly={readOnly} />
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
      <GalleryPicker
        value={gallery}
        onChange={setGallery}
        csrfToken={csrfToken}
        readOnly={readOnly}
      />
      <AmenityPicker
        scope="TOUR"
        value={amenities}
        onChange={setAmenities}
        csrfToken={csrfToken}
        readOnly={readOnly}
      />
      <fieldset disabled={readOnly} className="grid gap-4 border-t border-rule pt-4 md:grid-cols-2">
        <legend className="mb-2 text-[0.84rem] font-semibold">Trip details</legend>
        {(tour?.listPrice || tour?.salePrice) && (
          <p className="text-[0.8rem] text-ink-3 md:col-span-2">
            Old website price: {tour.listPrice ? money(tour.listPrice) : "—"}
            {tour.salePrice ? ` (offer ${money(tour.salePrice)})` : ""} — reference only; departures
            carry the real price.
          </p>
        )}
        <TextField label="Tour type" error={err("tourType")} {...register("tourType")} />
        <TextField label="Timing" error={err("timing")} {...register("timing")} />
        <TextAreaField
          label="Overview"
          className="md:col-span-2"
          error={err("overview")}
          {...register("overview")}
        />
        <TextAreaField
          label="Day-by-day itinerary"
          className="md:col-span-2"
          error={err("itinerary")}
          {...register("itinerary")}
        />
        <TextAreaField
          label="Transport"
          className="md:col-span-2"
          error={err("transport")}
          {...register("transport")}
        />
        <TextAreaField
          label="Tour policy"
          className="md:col-span-2"
          error={err("policy")}
          {...register("policy")}
        />
        <TextAreaField
          label="Cancellation policy"
          className="md:col-span-2"
          error={err("cancellationPolicy")}
          {...register("cancellationPolicy")}
        />
        <TextAreaField
          label="Travel tips"
          className="md:col-span-2"
          error={err("travelTips")}
          {...register("travelTips")}
        />
        <TextAreaField
          label="More information"
          className="md:col-span-2"
          error={err("additionalInfo")}
          {...register("additionalInfo")}
        />
        <TextAreaField
          label="Pick-up points (one per line)"
          error={err("pickupPoints")}
          {...register("pickupPoints")}
        />
        <TextAreaField label="Tags (one per line)" error={err("tags")} {...register("tags")} />
        <TextField
          label="Minimum adults"
          inputMode="numeric"
          error={err("minAdults")}
          {...register("minAdults")}
        />
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
