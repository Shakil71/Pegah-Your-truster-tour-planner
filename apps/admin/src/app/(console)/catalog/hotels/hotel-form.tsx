"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextAreaField, TextField, buttonClass } from "@pegah/ui";
import { HeroPicker, type HeroRef } from "@/components/media-picker";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { bpsToPercent, percentToBps } from "@/lib/money-input";

type Hotel = Schemas["AdminHotelDetailDto_Output"];
type Values = {
  slug: string;
  destinationSlug: string;
  name: string;
  nameBn: string;
  starRating: string;
  addressLine: string;
  summary: string;
  description: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  serviceCharge: string;
  vat: string;
  status: "DRAFT" | "PUBLISHED" | "SUSPENDED";
};

/**
 * Create or edit a hotel. Validation runs on the server with the shared
 * contract; field errors come back as problem details and are shown here.
 */
export function HotelForm({
  hotel,
  destinations,
  csrfToken,
  readOnly,
}: {
  hotel?: Hotel;
  destinations: { slug: string; name: string }[];
  csrfToken: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [hero, setHero] = useState<HeroRef | null>(hotel?.hero ?? null);
  const [message, setMessage] = useState<{ tone: "good" | "critical"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { register, handleSubmit, formState } = useForm<Values>({
    defaultValues: {
      slug: hotel?.slug ?? "",
      destinationSlug: hotel?.destination.slug ?? destinations[0]?.slug ?? "",
      name: hotel?.name ?? "",
      nameBn: hotel?.nameBn ?? "",
      starRating: hotel?.starRating ? String(hotel.starRating) : "",
      addressLine: hotel?.addressLine ?? "",
      summary: hotel?.summary ?? "",
      description: hotel?.description ?? "",
      checkInTime: hotel?.checkInTime ?? "14:00",
      checkOutTime: hotel?.checkOutTime ?? "12:00",
      cancellationPolicy: hotel?.cancellationPolicy ?? "",
      serviceCharge: bpsToPercent(hotel?.serviceChargeBps ?? 1000),
      vat: bpsToPercent(hotel?.vatBps ?? 1500),
      status: hotel?.status ?? "DRAFT",
    },
  });

  async function save(v: Values) {
    setMessage(null);
    setFieldErrors({});
    const sc = percentToBps(v.serviceCharge);
    const vat = percentToBps(v.vat);
    if (sc === null || vat === null) {
      setFieldErrors({
        ...(sc === null ? { serviceChargeBps: "Enter a percentage like 10 or 7.5" } : {}),
        ...(vat === null ? { vatBps: "Enter a percentage like 15" } : {}),
      });
      return;
    }
    const body = {
      destinationSlug: v.destinationSlug,
      name: v.name,
      nameBn: v.nameBn,
      starRating: v.starRating ? Number(v.starRating) : null,
      addressLine: v.addressLine,
      summary: v.summary,
      description: v.description,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      cancellationPolicy: v.cancellationPolicy,
      serviceChargeBps: sc,
      vatBps: vat,
      status: v.status,
      heroMedia: hero?.key ?? null,
    };
    const result = hotel
      ? await browserApi.PUT("/api/v1/admin/hotels/{slug}", {
          params: { path: { slug: hotel.slug } },
          headers: csrf(csrfToken),
          body,
        })
      : await browserApi.POST("/api/v1/admin/hotels", {
          headers: csrf(csrfToken),
          body: { ...body, slug: v.slug },
        });
    if (!result.response.ok) {
      const problem = result.error as { errors?: { path: string; message: string }[] } | undefined;
      setFieldErrors(Object.fromEntries((problem?.errors ?? []).map((e) => [e.path, e.message])));
      setMessage({ tone: "critical", text: problemMessage(result.error) });
      return;
    }
    if (!hotel) {
      router.push(`/catalog/hotels/${v.slug}`);
      return;
    }
    setMessage({ tone: "good", text: "Saved. The website updates within five minutes." });
    router.refresh();
  }

  const err = (k: string) => fieldErrors[k];

  return (
    <form onSubmit={handleSubmit(save)} className="panel grid gap-4 p-5 md:p-6" noValidate>
      <HeroPicker value={hero} onChange={setHero} csrfToken={csrfToken} readOnly={readOnly} />
      <fieldset disabled={readOnly} className="grid gap-4 md:grid-cols-2">
        <TextField
          label="URL slug"
          disabled={!!hotel || readOnly}
          hint={hotel ? "Fixed after creation." : "e.g. tea-garden-resort"}
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
        <TextField label="Name" error={err("name")} {...register("name")} />
        <TextField
          label="Name in Bangla (optional)"
          lang="bn"
          error={err("nameBn")}
          {...register("nameBn")}
        />
        <SelectField label="Star rating" error={err("starRating")} {...register("starRating")}>
          <option value="">Not rated</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" {...register("status")}>
          <option value="DRAFT">Draft (hidden)</option>
          <option value="PUBLISHED">Live on site</option>
          <option value="SUSPENDED">Suspended (hidden)</option>
        </SelectField>
        <TextField
          label="Address"
          className="md:col-span-2"
          error={err("addressLine")}
          {...register("addressLine")}
        />
        <TextAreaField
          label="Summary (shown in results)"
          className="md:col-span-2"
          error={err("summary")}
          {...register("summary")}
        />
        <TextAreaField
          label="Description (property page)"
          className="md:col-span-2"
          error={err("description")}
          {...register("description")}
        />
        <TextField
          label="Check-in from"
          type="time"
          error={err("checkInTime")}
          {...register("checkInTime")}
        />
        <TextField
          label="Check-out by"
          type="time"
          error={err("checkOutTime")}
          {...register("checkOutTime")}
        />
        <TextField
          label="Service charge %"
          inputMode="decimal"
          hint="On the room base"
          error={err("serviceChargeBps")}
          {...register("serviceCharge")}
        />
        <TextField
          label="VAT %"
          inputMode="decimal"
          hint="On base + service charge"
          error={err("vatBps")}
          {...register("vat")}
        />
        <TextAreaField
          label="Cancellation policy"
          className="md:col-span-2"
          error={err("cancellationPolicy")}
          {...register("cancellationPolicy")}
        />
      </fieldset>
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      {!readOnly && (
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className={buttonClass("primary", "md", "justify-self-start")}
        >
          {formState.isSubmitting ? "Saving…" : hotel ? "Save hotel" : "Create hotel"}
        </button>
      )}
    </form>
  );
}
