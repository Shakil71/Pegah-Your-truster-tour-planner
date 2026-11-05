import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, cx, type IconName } from "@pegah/ui";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { ensure, requireStaff, serverApi } from "@/lib/api-server";

export const metadata: Metadata = { title: "Settings" };

type Tone = "good" | "warn" | "off";
const TONE: Record<Tone, { cls: string; icon: IconName }> = {
  good: { cls: "bg-good-soft text-good", icon: "check" },
  warn: { cls: "bg-warn-soft text-warn", icon: "alert" },
  off: { cls: "bg-paper-2 text-ink-2", icon: "clock" },
};

function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold",
        TONE[tone].cls,
      )}
    >
      <Icon name={TONE[tone].icon} className="size-3.5" />
      {children}
    </span>
  );
}

function Card({
  title,
  status,
  children,
}: {
  title: string;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel grid content-start gap-3 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[1rem] font-semibold">{title}</h2>
        {status}
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-2 text-[0.88rem]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
          <dt className="text-ink-2">{k}</dt>
          <dd className="tabular font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const minutes = (m: number) => (m % 60 === 0 ? `${m / 60} h` : `${m} min`);

/**
 * What is switched on, at a glance. Values come from the server's environment
 * files and are changed by the operator on the server, never from the browser.
 */
export default async function SettingsPage() {
  const session = await requireStaff();
  if (!session.user.permissions.includes("settings:read")) {
    return <NoAccess what="system settings" permission="settings:read" />;
  }
  const api = await serverApi();
  const s = ensure(await api.GET("/api/v1/admin/settings"));
  const p = s.payments;
  const paymentTone: Tone =
    p.provider === "sslcommerz" && p.mode === "live"
      ? "good"
      : p.provider === "none"
        ? "off"
        : "warn";
  const paymentLabel =
    p.provider === "none"
      ? "Off"
      : p.provider === "simulator"
        ? "Simulator (no money moves)"
        : p.mode === "live"
          ? "SSLCOMMERZ live"
          : "SSLCOMMERZ sandbox";
  const emailTone: Tone =
    s.email.transport === "smtp" ? (s.email.failed > 0 ? "warn" : "good") : "off";

  return (
    <div className="mx-auto grid max-w-[1100px] gap-6">
      <PageHeader
        eyebrow="System"
        title="Settings"
        intro="What is switched on right now. These values live in the server's environment files and are changed on the server by the operator, then the services are restarted; nothing here can be changed from the browser."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Online payment" status={<Status tone={paymentTone}>{paymentLabel}</Status>}>
          <Facts
            rows={[
              ["Provider", p.provider],
              ["Credentials on the server", p.credentialsSet ? "Set" : "Not set"],
              ["Live mode approved", p.liveApproved ? "Yes" : "No"],
              ["Return address", p.publicBaseUrl ?? "Not set"],
              ["Extra hold time at payment", minutes(p.holdExtensionMinutes)],
            ]}
          />
          {p.provider === "none" && (
            <p className="text-[0.84rem] text-ink-2">
              Customers can hold rooms and seats, but cannot pay online, so no booking is confirmed
              by payment. Switch-on steps: <code>docs/operations/SSLCOMMERZ_INTEGRATION.md</code>.
            </p>
          )}
        </Card>

        <Card
          title="Email"
          status={
            <Status tone={emailTone}>
              {s.email.transport === "smtp" ? "Sending" : "Not sending"}
            </Status>
          }
        >
          <Facts
            rows={[
              ["Transport", s.email.transport],
              ["From", s.email.from],
              ["SMTP server", s.email.smtpHost ?? "—"],
              ["Waiting to send", String(s.email.queued)],
              ["Failed", String(s.email.failed)],
            ]}
          />
          <p className="text-[0.84rem] text-ink-2">
            {s.email.transport === "smtp"
              ? "Booking emails are sent through SMTP. Each booking's emails are listed on its page."
              : "Emails are recorded but not sent. Customers do not receive booking or password-reset emails until SMTP is configured."}
          </p>
        </Card>

        <Card title="Bookings" status={<Status tone="good">Active</Status>}>
          <Facts
            rows={[
              ["Hold length", minutes(s.booking.holdMinutes)],
              ["Expired holds released every", `${s.booking.holdSweepSeconds} s`],
            ]}
          />
          <p className="text-[0.84rem] text-ink-2">
            Prices and availability are rechecked on the server before every hold. Rates and rooms
            on sale are edited in{" "}
            <Link href="/catalog/hotels" className="font-semibold text-primary-ink">
              Hotels
            </Link>
            .
          </p>
        </Card>

        <Card title="Sign-in sessions" status={<Status tone="good">Secure cookies</Status>}>
          <Facts
            rows={[
              ["Customers: maximum", minutes(s.sessions.customerTtlMinutes)],
              ["Customers: idle sign-out", minutes(s.sessions.customerIdleMinutes)],
              ["Staff and partners: maximum", minutes(s.sessions.staffTtlMinutes)],
              ["Staff and partners: idle sign-out", minutes(s.sessions.staffIdleMinutes)],
            ]}
          />
        </Card>

        <Card
          title="This server"
          status={
            <Status tone={s.database === "up" ? "good" : "warn"}>
              Database {s.database === "up" ? "up" : "down"}
            </Status>
          }
        >
          <Facts
            rows={[
              ["Environment", s.environment],
              ["Version", s.version],
              ["Commit", s.commit ? s.commit.slice(0, 7) : "local build"],
              ["Built", s.builtAt ?? "—"],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
