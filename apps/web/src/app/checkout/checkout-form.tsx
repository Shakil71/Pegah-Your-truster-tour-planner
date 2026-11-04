"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { BookingContactSchema, GuestInputSchema } from "@pegah/contracts";
import { FormAlert, Icon, TextField, buttonClass, zodResolver } from "@pegah/ui";
import { z } from "zod";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Request =
  | {
      product: "HOTEL";
      roomId: string;
      checkIn: string;
      checkOut: string;
      rooms: number;
      adults: number;
      children: number;
    }
  | { product: "TOUR"; departureId: string; adults: number; children: number };

type Values = {
  contact: { name: string; email: string; phone: string };
  guests: { fullName: string; ageGroup: "ADULT" | "CHILD" }[];
};

const FormSchema = z.object({
  contact: BookingContactSchema,
  guests: z.array(GuestInputSchema),
});

/**
 * Collects contact and traveller names and asks the API to hold the booking.
 * The total shown is the server's quote; the API recomputes it under a lock
 * and answers 409 price-changed if it moved. One Idempotency-Key per form, so
 * a double click or a retry after a network error never books twice.
 */
export function CheckoutForm({
  request,
  expectedTotal,
  adultCount: adults,
  childCount: children,
  csrfToken,
  savedTravellers,
  customer,
}: {
  request: Request;
  expectedTotal: { amountMinor: number; currency: "BDT" | "USD" };
  adultCount: number;
  childCount: number;
  csrfToken: string;
  /** Saved travellers offered as name suggestions. */
  savedTravellers: { fullName: string; ageGroup: "ADULT" | "CHILD" }[];
  customer: { name: string; email: string; phone: string };
}) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      contact: customer,
      guests: [
        ...Array.from({ length: adults }, (_, i) => ({
          fullName: i === 0 ? customer.name : "",
          ageGroup: "ADULT" as const,
        })),
        ...Array.from({ length: children }, () => ({ fullName: "", ageGroup: "CHILD" as const })),
      ],
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const {
      data,
      error: problem,
      response,
    } = await browserApi.POST("/api/v1/bookings", {
      params: { header: { "Idempotency-Key": idempotencyKey } },
      headers: csrf(csrfToken),
      body: { ...request, contact: values.contact, guests: values.guests, expectedTotal },
    });
    if (response.ok && data) {
      router.push(`/account/bookings/${data.id}?new=1`);
      return;
    }
    const type = (problem as { type?: string } | undefined)?.type;
    if (type === "/problems/price-changed") {
      setError(`${problemMessage(problem)} The page has been refreshed with the new price.`);
      router.refresh();
      return;
    }
    if (response.status === 401) {
      router.push(
        `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
      return;
    }
    setError(
      response.status === 429
        ? "Too many attempts. Please wait a minute and try again."
        : problemMessage(problem),
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid content-start gap-6" noValidate>
      <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="contact-h">
        <h2 id="contact-h" className="text-[1rem] font-semibold">
          Contact for this booking
        </h2>
        <TextField
          label="Full name"
          autoComplete="name"
          error={errors.contact?.name?.message}
          {...register("contact.name")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.contact?.email?.message}
            {...register("contact.email")}
          />
          <TextField
            label="Mobile"
            type="tel"
            autoComplete="tel"
            placeholder="+8801XXXXXXXXX"
            hint="We send booking updates here."
            error={errors.contact?.phone?.message}
            {...register("contact.phone")}
          />
        </div>
      </section>

      <section className="panel grid gap-4 p-5 md:p-6" aria-labelledby="trav-h">
        <h2 id="trav-h" className="text-[1rem] font-semibold">
          Travellers <span className="font-normal text-ink-3">(names as on ID)</span>
        </h2>
        {Array.from({ length: adults + children }, (_, i) => (
          <TextField
            key={i}
            label={
              i === 0
                ? "Lead guest (adult)"
                : i < adults
                  ? `Adult ${i + 1}`
                  : `Child ${i - adults + 1}`
            }
            autoComplete={i === 0 ? "name" : "off"}
            list={i < adults ? "saved-adults" : "saved-children"}
            error={errors.guests?.[i]?.fullName?.message}
            {...register(`guests.${i}.fullName` as const)}
          />
        ))}
      </section>

      <datalist id="saved-adults">
        {savedTravellers
          .filter((t) => t.ageGroup === "ADULT")
          .map((t) => (
            <option key={t.fullName} value={t.fullName} />
          ))}
      </datalist>
      <datalist id="saved-children">
        {savedTravellers
          .filter((t) => t.ageGroup === "CHILD")
          .map((t) => (
            <option key={t.fullName} value={t.fullName} />
          ))}
      </datalist>

      <label className="flex items-start gap-3 text-[0.9rem]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-4 accent-[var(--pg-primary)]"
        />
        <span>
          I understand this <b>holds</b> the booking for 15 minutes and that it is not confirmed
          until payment is completed.
        </span>
      </label>

      {error && <FormAlert>{error}</FormAlert>}

      <button
        type="submit"
        disabled={isSubmitting || !agreed}
        className={buttonClass("primary", "lg")}
      >
        {isSubmitting ? "Holding…" : "Hold my booking"}
        {!isSubmitting && <Icon name="arrowRight" className="size-[18px]" />}
      </button>
    </form>
  );
}
