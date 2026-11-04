"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi, csrf } from "@/lib/api-browser";

export function SignOutButton({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await browserApi.POST("/api/v1/auth/logout", { headers: csrf(csrfToken) });
        router.replace("/");
        router.refresh();
      }}
      className="rounded-full border border-rule bg-card px-4 py-2 text-[0.86rem] font-semibold hover:border-ink disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
