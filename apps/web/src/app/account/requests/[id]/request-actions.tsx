"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormAlert, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";
import { prepareDocument } from "@/lib/prepare-document";

const LABELS = ["Passport", "Photo", "Bank", "NID", "Other"] as const;

/** Reply, upload documents and cancel, for the customer's own request. */
export function RequestActions({
  requestId,
  csrfToken,
  canReply,
  canCancel,
  canUpload,
  uploadsEnabled,
  closed,
}: {
  requestId: string;
  csrfToken: string;
  canReply: boolean;
  canCancel: boolean;
  canUpload: boolean;
  uploadsEnabled: boolean;
  closed: boolean;
}) {
  const t = useTranslations("services");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState<(typeof LABELS)[number]>("Passport");
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"reply" | "upload" | "cancel" | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "critical"; text: string } | null>(null);

  async function reply() {
    setBusy("reply");
    setNotice(null);
    const { error, response } = await browserApi.POST("/api/v1/me/requests/{id}/reply", {
      params: { path: { id: requestId } },
      headers: csrf(csrfToken),
      body: { message },
    });
    setBusy(null);
    if (!response.ok) return setNotice({ tone: "critical", text: problemMessage(error) });
    setMessage("");
    router.refresh();
  }

  async function upload() {
    const chosen = file.current?.files?.[0];
    if (!chosen) return;
    setBusy("upload");
    setNotice(null);
    try {
      const body = await prepareDocument(chosen);
      const res = await fetch(
        `/api/v1/me/requests/${requestId}/documents?${new URLSearchParams({ label: t(`label_${label}`), name: chosen.name })}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/octet-stream", ...csrf(csrfToken) },
          body,
        },
      );
      if (res.status === 413) throw new Error(t("tooLarge"));
      if (!res.ok) throw new Error(problemMessage(await res.json().catch(() => null)));
      if (file.current) file.current.value = "";
      setNotice({ tone: "good", text: t("uploaded") });
      router.refresh();
    } catch (e) {
      setNotice({ tone: "critical", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy("cancel");
    const { error, response } = await browserApi.POST("/api/v1/me/requests/{id}/cancel", {
      params: { path: { id: requestId } },
      headers: csrf(csrfToken),
      body: {},
    });
    setBusy(null);
    if (!response.ok) return setNotice({ tone: "critical", text: problemMessage(error) });
    router.refresh();
  }

  if (closed && !canReply)
    return notice ? <FormAlert tone={notice.tone}>{notice.text}</FormAlert> : null;

  return (
    <div className="grid gap-5">
      {(canUpload || (!uploadsEnabled && !closed)) && (
        <section className="panel p-5 md:p-6" aria-labelledby="up-h">
          <h2 id="up-h" className="text-[1rem] font-semibold">
            {t("documents")}
          </h2>
          {!uploadsEnabled ? (
            <p className="mt-2 text-[0.9rem] text-ink-2">{t("uploadsOff")}</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-[0.84rem] font-semibold">
                {t("documentLabel")}
                <select
                  value={label}
                  onChange={(e) => setLabel(e.target.value as (typeof LABELS)[number])}
                  className="h-11 rounded-md border border-rule bg-card px-3 font-normal"
                >
                  {LABELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`label_${l}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[0.84rem] font-semibold">
                {t("chooseFile")}
                <input
                  ref={file}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="text-[0.86rem] font-normal file:mr-3 file:rounded-md file:border file:border-rule file:bg-card file:px-3 file:py-2"
                />
              </label>
              <button
                type="button"
                onClick={upload}
                disabled={busy !== null}
                className={buttonClass("outline", "md")}
              >
                {busy === "upload" ? t("uploading") : t("upload")}
              </button>
            </div>
          )}
        </section>
      )}

      {canReply && (
        <section className="panel p-5 md:p-6" aria-labelledby="rep-h">
          <label id="rep-h" htmlFor="reply" className="text-[1rem] font-semibold">
            {t("reply")}
          </label>
          <textarea
            id="reply"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-2 w-full rounded-md border border-rule bg-card px-3 py-2 text-[0.92rem]"
          />
          <div className="mt-2 flex flex-wrap justify-between gap-3">
            <button
              type="button"
              onClick={reply}
              disabled={busy !== null || message.trim().length < 2}
              className={buttonClass("primary", "md")}
            >
              {busy === "reply" ? t("submitting") : t("sendReply")}
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={cancel}
                disabled={busy !== null}
                className={buttonClass("ghost", "md")}
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </section>
      )}
      {notice && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
    </div>
  );
}
