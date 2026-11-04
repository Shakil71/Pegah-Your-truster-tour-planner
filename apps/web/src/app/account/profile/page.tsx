import type { Metadata } from "next";
import { AccountTabs } from "@/components/shop/account-tabs";
import { PageShell } from "@/components/shop/page-shell";
import { ensure, requireCustomer, serverApi } from "@/lib/api-server";
import { PasswordForm, ProfileForm } from "./profile-forms";
import { TravellersManager } from "./travellers-manager";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireCustomer("/account/profile");
  const api = await serverApi();
  const [profile, travellers] = await Promise.all([
    api.GET("/api/v1/me/profile").then(ensure),
    api.GET("/api/v1/me/travellers").then(ensure),
  ]);
  return (
    <PageShell>
      <div className="grid gap-6">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-primary-ink">
            {profile.email}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(2rem,3.6vw,3rem)] font-medium leading-tight">
            Your profile
          </h1>
        </div>
        <AccountTabs active="profile" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileForm profile={profile} csrfToken={session.csrfToken} />
          <PasswordForm csrfToken={session.csrfToken} />
        </div>
        <TravellersManager items={travellers.items} csrfToken={session.csrfToken} />
      </div>
    </PageShell>
  );
}
