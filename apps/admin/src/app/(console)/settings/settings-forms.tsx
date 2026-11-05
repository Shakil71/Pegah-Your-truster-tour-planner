"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, TextField, buttonClass, cx } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type View = Schemas["AdminSiteSettingsDto_Output"];
type Note = { tone: "good" | "critical"; text: string } | null;

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
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

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 text-[0.9rem]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-[var(--pg-primary)]"
      />
      <span>
        {label}
        {hint && <span className="block text-[0.78rem] text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}

const select =
  "h-11 w-full rounded-control border border-rule bg-card px-3 text-[0.92rem] outline-none focus:border-ink";

/** Saves one section with PUT and refreshes the page; shows the API's message on failure. */
function useSave(csrfToken: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  async function save(
    path:
      | "/api/v1/admin/settings/general"
      | "/api/v1/admin/settings/announcement"
      | "/api/v1/admin/settings/booking"
      | "/api/v1/admin/settings/payments"
      | "/api/v1/admin/settings/email",
    body: object,
  ): Promise<boolean> {
    setBusy(true);
    setNote(null);
    // The body matches the endpoint's DTO; the API validates it again.
    const { error, response } = await browserApi.PUT(path, {
      headers: csrf(csrfToken),
      body: body as never,
    });
    setBusy(false);
    if (!response.ok) {
      setNote({ tone: "critical", text: problemMessage(error) });
      return false;
    }
    setNote({ tone: "good", text: "Saved. It applies within 30 seconds everywhere." });
    router.refresh();
    return true;
  }
  return { busy, note, save };
}

export function GeneralForm({ view, csrfToken }: { view: View; csrfToken: string }) {
  const [v, setV] = useState(view.general);
  const { busy, note, save } = useSave(csrfToken);
  return (
    <Section
      title="Contact details"
      intro="Shown in the website footer and on pages that tell customers how to reach you."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label="Support phone"
          value={v.supportPhone}
          onChange={(e) => setV({ ...v, supportPhone: e.target.value })}
          placeholder="+8809612XXXXXX"
        />
        <TextField
          label="WhatsApp (optional)"
          value={v.whatsapp}
          onChange={(e) => setV({ ...v, whatsapp: e.target.value })}
        />
        <TextField
          label="Support email"
          type="email"
          value={v.supportEmail}
          onChange={(e) => setV({ ...v, supportEmail: e.target.value })}
        />
        <TextField
          label="Office address"
          value={v.officeAddress}
          onChange={(e) => setV({ ...v, officeAddress: e.target.value })}
        />
      </div>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="button"
        disabled={busy}
        onClick={() => save("/api/v1/admin/settings/general", v)}
        className={buttonClass("primary", "sm", "justify-self-start")}
      >
        {busy ? "Saving…" : "Save contact details"}
      </button>
    </Section>
  );
}

export function AnnouncementForm({ view, csrfToken }: { view: View; csrfToken: string }) {
  const [v, setV] = useState(view.announcement);
  const { busy, note, save } = useSave(csrfToken);
  return (
    <Section
      title="Announcement banner"
      intro="A short message across the top of every website page, in English and Bangla. Turn it off when it is no longer true."
    >
      <Toggle
        label="Show the banner on the website"
        checked={v.enabled}
        onChange={(enabled) => setV({ ...v, enabled })}
      />
      <TextField
        label="Message in English"
        value={v.textEn}
        maxLength={240}
        onChange={(e) => setV({ ...v, textEn: e.target.value })}
      />
      <TextField
        label="Message in Bangla"
        lang="bn"
        value={v.textBn}
        maxLength={240}
        onChange={(e) => setV({ ...v, textBn: e.target.value })}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          Tone
          <select
            value={v.tone}
            onChange={(e) => setV({ ...v, tone: e.target.value as "info" | "warning" })}
            className={select}
          >
            <option value="info">Information</option>
            <option value="warning">Warning</option>
          </select>
        </label>
        <TextField
          label="Link (optional)"
          placeholder="/pages/offers or https://…"
          value={v.linkHref}
          onChange={(e) => setV({ ...v, linkHref: e.target.value })}
        />
      </div>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="button"
        disabled={busy}
        onClick={() => save("/api/v1/admin/settings/announcement", v)}
        className={buttonClass("primary", "sm", "justify-self-start")}
      >
        {busy ? "Saving…" : "Save banner"}
      </button>
    </Section>
  );
}

export function BookingForm({ view, csrfToken }: { view: View; csrfToken: string }) {
  const [hold, setHold] = useState(String(view.booking.holdMinutes));
  const [ext, setExt] = useState(String(view.booking.paymentExtensionMinutes));
  const { busy, note, save } = useSave(csrfToken);
  return (
    <Section
      title="Booking times"
      intro="How long a hold keeps rooms or seats, and the extra time given once when the customer opens the payment page. Applies to new holds."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label="Hold length (minutes, 5–60)"
          type="number"
          min={5}
          max={60}
          value={hold}
          onChange={(e) => setHold(e.target.value)}
        />
        <TextField
          label="Extra time at payment (minutes, 0–60)"
          type="number"
          min={0}
          max={60}
          value={ext}
          onChange={(e) => setExt(e.target.value)}
        />
      </div>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          save("/api/v1/admin/settings/booking", {
            holdMinutes: Number(hold),
            paymentExtensionMinutes: Number(ext),
          })
        }
        className={buttonClass("primary", "sm", "justify-self-start")}
      >
        {busy ? "Saving…" : "Save booking times"}
      </button>
    </Section>
  );
}

function SourceNote({ source }: { source: "console" | "server" }) {
  return (
    <p className="text-[0.78rem] text-ink-3">
      {source === "console"
        ? "Currently set here in the console."
        : "Currently taken from the server file (api.env). Saving here takes over."}
    </p>
  );
}

function SecretField({
  label,
  isSet,
  value,
  onChange,
  disabled,
}: {
  label: string;
  isSet: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <TextField
      label={label}
      type="password"
      autoComplete="new-password"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={isSet ? "•••••••• (saved — leave empty to keep)" : "Not set"}
      hint="Stored encrypted. It is never shown again, only replaced."
    />
  );
}

export function PaymentsForm({ view, csrfToken }: { view: View; csrfToken: string }) {
  const p = view.payments;
  const [provider, setProvider] = useState<"none" | "sslcommerz">(
    p.provider === "sslcommerz" ? "sslcommerz" : "none",
  );
  const [mode, setMode] = useState(p.mode);
  const [liveApproved, setLiveApproved] = useState(p.liveApproved);
  const [storeId, setStoreId] = useState(p.storeId);
  const [password, setPassword] = useState("");
  const { busy, note, save } = useSave(csrfToken);

  async function submit() {
    if (
      mode === "live" &&
      !window.confirm("Switch to LIVE payments? Real money will be charged.")
    ) {
      return;
    }
    const ok = await save("/api/v1/admin/settings/payments", {
      provider,
      mode,
      liveApproved,
      storeId,
      ...(password ? { storePassword: password } : {}),
    });
    if (ok) setPassword("");
  }

  return (
    <Section
      title="Online payment (SSLCOMMERZ)"
      intro="Customers pay on SSLCOMMERZ's secure page; card details never reach Pegah. Test in sandbox first, then switch to live with your approval."
    >
      <SourceNote source={p.source} />
      {p.provider === "simulator" && (
        <FormAlert tone="critical">
          The server uses the development payment simulator. Save real settings here to replace it.
        </FormAlert>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          Payment
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "none" | "sslcommerz")}
            className={select}
          >
            <option value="none">Off (holds only)</option>
            <option value="sslcommerz">SSLCOMMERZ</option>
          </select>
        </label>
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "sandbox" | "live")}
            className={select}
          >
            <option value="sandbox">Sandbox (test, no money moves)</option>
            <option value="live">Live (real payments)</option>
          </select>
        </label>
        <TextField label="Store ID" value={storeId} onChange={(e) => setStoreId(e.target.value)} />
        <SecretField
          label="Store password"
          isSet={p.storePasswordSet}
          value={password}
          onChange={setPassword}
          disabled={!view.encryptionReady}
        />
      </div>
      <Toggle
        label="I approve live payments (sandbox checklist passed)"
        hint="Required before Live mode can be saved."
        checked={liveApproved}
        onChange={setLiveApproved}
      />
      <p className="text-[0.78rem] text-ink-3">
        Return address: <code>{view.publicBaseUrl ?? "not set on the server"}</code>
      </p>
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className={buttonClass("primary", "sm", "justify-self-start")}
      >
        {busy ? "Saving…" : "Save payment settings"}
      </button>
    </Section>
  );
}

export function EmailForm({ view, csrfToken }: { view: View; csrfToken: string }) {
  const e0 = view.email;
  const [transport, setTransport] = useState<"none" | "smtp">(
    e0.transport === "smtp" ? "smtp" : "none",
  );
  const [from, setFrom] = useState(e0.from);
  const [host, setHost] = useState(e0.smtpHost);
  const [port, setPort] = useState(String(e0.smtpPort));
  const [secure, setSecure] = useState(e0.smtpSecure);
  const [user, setUser] = useState(e0.smtpUser);
  const [password, setPassword] = useState("");
  const [testNote, setTestNote] = useState<Note>(null);
  const [testing, setTesting] = useState(false);
  const { busy, note, save } = useSave(csrfToken);

  async function submit() {
    const ok = await save("/api/v1/admin/settings/email", {
      transport,
      from,
      smtpHost: host,
      smtpPort: Number(port),
      smtpSecure: secure,
      smtpUser: user,
      ...(password ? { smtpPassword: password } : {}),
    });
    if (ok) setPassword("");
  }

  async function test() {
    setTesting(true);
    setTestNote(null);
    const { data, error, response } = await browserApi.POST("/api/v1/admin/settings/email/test", {
      headers: csrf(csrfToken),
    });
    setTesting(false);
    setTestNote(
      response.ok && data
        ? data.status === "SENT"
          ? { tone: "good", text: `Test email sent to ${data.to}. Check the inbox.` }
          : {
              tone: "critical",
              text:
                data.status === "SKIPPED"
                  ? "Email sending is off, so nothing was sent."
                  : "Sending failed. Check the server, user name and password.",
            }
        : { tone: "critical", text: problemMessage(error) },
    );
  }

  return (
    <Section
      title="Email (SMTP)"
      intro="Booking confirmations, vouchers and password-reset emails. Use your mail provider's SMTP details; connections are always encrypted."
    >
      <SourceNote source={e0.source} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-[0.84rem] font-semibold">
          Sending
          <select
            value={transport}
            onChange={(e) => setTransport(e.target.value as "none" | "smtp")}
            className={select}
          >
            <option value="none">Off (record only)</option>
            <option value="smtp">SMTP</option>
          </select>
        </label>
        <TextField label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField label="SMTP server" value={host} onChange={(e) => setHost(e.target.value)} />
        <TextField
          label="Port"
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          hint="587 with STARTTLS, or 465 with TLS."
        />
        <TextField label="User name" value={user} onChange={(e) => setUser(e.target.value)} />
        <SecretField
          label="Password"
          isSet={e0.smtpPasswordSet}
          value={password}
          onChange={setPassword}
          disabled={!view.encryptionReady}
        />
      </div>
      <Toggle
        label="Use TLS from the start (port 465)"
        hint="Off = STARTTLS on port 587. Unencrypted SMTP is never used."
        checked={secure}
        onChange={setSecure}
      />
      {note && <FormAlert tone={note.tone}>{note.text}</FormAlert>}
      {testNote && <FormAlert tone={testNote.tone}>{testNote.text}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className={buttonClass("primary", "sm")}
        >
          {busy ? "Saving…" : "Save email settings"}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={test}
          className={cx(buttonClass("outline", "sm"))}
        >
          {testing ? "Sending…" : "Send me a test email"}
        </button>
      </div>
    </Section>
  );
}
