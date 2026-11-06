"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, SelectField, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Profile = Schemas["ProfileDto_Output"];
type Note = { tone: "good" | "critical"; text: string } | null;

function fieldErrors(problem: unknown): Record<string, string> {
  const errors =
    (problem as { errors?: { path: string; message: string }[] } | undefined)?.errors ?? [];
  return Object.fromEntries(errors.map((e) => [e.path, e.message]));
}

export function ProfileForm({ profile, csrfToken }: { profile: Profile; csrfToken: string }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [locale, setLocale] = useState<"en" | "bn">(profile.locale);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.PUT("/api/v1/me/profile", {
      headers: csrf(csrfToken),
      body: { fullName, phone: phone.trim() || null, locale },
    });
    setBusy(false);
    setErrs(fieldErrors(error));
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setNote({ tone: "good", text: t("saved") });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[1rem] font-semibold">{t("details")}</h2>
      <TextField
        label={t("fullName")}
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errs.fullName}
      />
      <TextField
        label={t("mobile")}
        type="tel"
        autoComplete="tel"
        placeholder="+8801XXXXXXXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errs.phone}
      />
      <TextField label={t("email")} value={profile.email} disabled hint={t("emailHint")} />
      <SelectField
        label={t("emailLanguage")}
        value={locale}
        onChange={(e) => setLocale(e.target.value === "bn" ? "bn" : "en")}
      >
        <option value="en">English</option>
        <option value="bn" lang="bn">
          বাংলা
        </option>
      </SelectField>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="submit"
        disabled={busy}
        className={buttonClass("primary", "md", "justify-self-start")}
      >
        {busy ? t("saving") : t("saveDetails")}
      </button>
    </form>
  );
}

export function PasswordForm({
  csrfToken,
  partner = false,
}: {
  csrfToken: string;
  /** Partner portal user: changes the password through the partner API. */
  partner?: boolean;
}) {
  const t = useTranslations("profile");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.POST(
      partner ? "/api/v1/partner/auth/password" : "/api/v1/me/password",
      {
        headers: csrf(csrfToken),
        body: { currentPassword: current, newPassword: next },
      },
    );
    setBusy(false);
    setErrs(fieldErrors(error));
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setCurrent("");
    setNext("");
    setNote({ tone: "good", text: t("passwordChanged") });
  }

  return (
    <form onSubmit={save} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[1rem] font-semibold">{t("changePassword")}</h2>
      <TextField
        label={t("currentPassword")}
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errs.currentPassword}
      />
      <TextField
        label={t("newPassword")}
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint={t("tenChars")}
        error={errs.newPassword}
      />
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !current || next.length < 10}
        className={buttonClass("ink", "md", "justify-self-start")}
      >
        {busy ? t("changing") : t("changePassword")}
      </button>
    </form>
  );
}
