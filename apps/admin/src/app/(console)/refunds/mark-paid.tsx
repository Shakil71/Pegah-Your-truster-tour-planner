"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

/** Records that finance returned the money; the booking becomes REFUNDED when nothing is pending. */
export function MarkPaid({ refundId, csrfToken }: { refundId: string; csrfToken: string }) {
  const router = useRouter();
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/admin/refunds/{id}/paid", {
      params: { path: { id: refundId } },
      headers: csrf(csrfToken),
      body: { providerRef: ref },
    });
    setBusy(false);
    if (!response.ok) {
      setError(problemMessage(problem));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
      <label className="sr-only" htmlFor={`ref-${refundId}`}>
        Provider or bank reference
      </label>
      <input
        id={`ref-${refundId}`}
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Provider / bank reference"
        maxLength={120}
        className="h-9 w-56 rounded-control border border-rule px-3 text-[0.84rem]"
      />
      <button
        type="submit"
        disabled={busy || ref.trim().length < 3}
        className={buttonClass("primary", "sm")}
      >
        {busy ? "Saving…" : "Mark paid"}
      </button>
      {error && <p className="w-full text-[0.78rem] text-critical">{error}</p>}
    </form>
  );
}
