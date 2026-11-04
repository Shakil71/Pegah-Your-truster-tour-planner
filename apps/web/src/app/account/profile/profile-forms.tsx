"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Profile = Schemas["ProfileDto_Output"];
type Note = { tone: "good" | "critical"; text: string } | null;

function fieldErrors(problem: unknown): Record<string, string> {
  const errors =
    (problem as { errors?: { path: string; message: string }[] } | undefined)?.errors ?? [];
  return Object.fromEntries(errors.map((e) => [e.path, e.message]));
}

export function ProfileForm({ profile, csrfToken }: { profile: Profile; csrfToken: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.PUT("/api/v1/me/profile", {
      headers: csrf(csrfToken),
      body: { fullName, phone: phone.trim() || null },
    });
    setBusy(false);
    setErrs(fieldErrors(error));
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setNote({ tone: "good", text: "Saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[1rem] font-semibold">Your details</h2>
      <TextField
        label="Full name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errs.fullName}
      />
      <TextField
        label="Mobile"
        type="tel"
        autoComplete="tel"
        placeholder="+8801XXXXXXXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={errs.phone}
      />
      <TextField
        label="Email"
        value={profile.email}
        disabled
        hint="Contact us to change your sign-in email."
      />
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="submit"
        disabled={busy}
        className={buttonClass("primary", "md", "justify-self-start")}
      >
        {busy ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

export function PasswordForm({ csrfToken }: { csrfToken: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const { error, response } = await browserApi.POST("/api/v1/me/password", {
      headers: csrf(csrfToken),
      body: { currentPassword: current, newPassword: next },
    });
    setBusy(false);
    setErrs(fieldErrors(error));
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return;
    }
    setCurrent("");
    setNext("");
    setNote({ tone: "good", text: "Password changed. Other devices have been signed out." });
  }

  return (
    <form onSubmit={save} className="panel grid content-start gap-4 p-5 md:p-6">
      <h2 className="text-[1rem] font-semibold">Change password</h2>
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errs.currentPassword}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="At least 10 characters."
        error={errs.newPassword}
      />
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="submit"
        disabled={busy || !current || next.length < 10}
        className={buttonClass("ink", "md", "justify-self-start")}
      >
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
