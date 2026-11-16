"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { FormAlert, Icon, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

const TOPICS = ["BOOKING", "RESERVATION", "PACKAGE", "OTHER"] as const;
type Topic = (typeof TOPICS)[number];

/**
 * Contact form (ADR-0041). Anyone can send it; the API rate-limits it and a
 * hidden field catches bots. Sending holds or confirms nothing.
 */
export function ContactForm({
  initial,
  initialTopic,
}: {
  initial: { name: string; email: string; phone: string };
  initialTopic?: Topic;
}) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [topic, setTopic] = useState<Topic>(initialTopic ?? "BOOKING");
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [travelDate, setTravelDate] = useState("");
  const [guests, setGuests] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const trip = topic === "BOOKING" || topic === "RESERVATION" || topic === "PACKAGE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: problem } = await browserApi.POST("/api/v1/contact", {
      body: {
        topic,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
        locale: locale === "bn" ? "bn" : "en",
        ...(trip && travelDate ? { travelDate } : {}),
        ...(trip && guests ? { guests: Number(guests) } : {}),
        ...(website ? { website } : {}),
      },
    });
    setBusy(false);
    if (data) {
      setSent(data.reference);
      return;
    }
    setError(problemMessage(problem));
  }

  if (sent) {
    return (
      <div className="panel grid justify-items-start gap-3 p-6 md:p-8" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-good-soft text-good">
          <Icon name="check" className="size-6" />
        </span>
        <h2 className="font-display text-[1.8rem] font-medium">{t("sentTitle")}</h2>
        <p className="text-ink-2">{t("sentBody", { reference: sent })}</p>
        <p className="tabular rounded-[10px] bg-paper-2 px-3 py-1.5 font-semibold">{sent}</p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setMessage("");
          }}
          className={buttonClass("outline", "sm")}
        >
          {t("another")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="panel grid gap-6 p-6 md:p-8" noValidate>
      <div>
        <h2 className="font-display text-[1.8rem] font-medium">{t("formTitle")}</h2>
        <p className="mt-1 text-[0.9rem] text-ink-2">{t("formIntro")}</p>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-[0.9rem] font-semibold">{t("topicLabel")}</legend>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TOPICS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={topic === k}
              onClick={() => setTopic(k)}
              className={cx(
                "min-h-12 rounded-control border-[1.5px] px-3 py-2 text-[0.88rem] font-semibold leading-tight",
                topic === k ? "border-primary bg-primary-soft" : "border-rule hover:border-ink",
              )}
            >
              {t(`topics.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField
            label={t("name")}
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <TextField
          label={t("email")}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t("phone")}
          type="tel"
          autoComplete="tel"
          required
          placeholder="+8801XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {trip && (
          <>
            <TextField
              label={t("travelDate")}
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
            />
            <TextField
              label={t("guests")}
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={guests}
              onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
            />
          </>
        )}
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="contact-message" className="text-[0.9rem] font-semibold">
          {t("message")}
        </label>
        <textarea
          id="contact-message"
          required
          rows={6}
          maxLength={3000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t(`placeholders.${topic}`)}
          aria-describedby="contact-message-hint"
          className="rounded-control border-[1.5px] border-rule bg-card px-4 py-3 text-[0.95rem] outline-none focus:border-ink"
        />
        <p id="contact-message-hint" className="text-[0.76rem] text-ink-3">
          {t("messageHint")}
        </p>
      </div>

      {/* Honeypot for bots: hidden from people and from assistive technology. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && <FormAlert>{error}</FormAlert>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy || message.trim().length < 10}
          className={buttonClass("primary", "lg")}
        >
          {busy ? t("sending") : t("send")}
        </button>
        <p className="text-[0.8rem] text-ink-3">{t("noBooking")}</p>
      </div>
    </form>
  );
}
