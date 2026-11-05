"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Schemas } from "@pegah/api-client";
import { FormAlert, Icon, SelectField, TextField, buttonClass } from "@pegah/ui";
import { browserApi, csrf, problemMessage } from "@/lib/api-browser";

type Traveller = Schemas["Traveller_Output"];
type Draft = {
  fullName: string;
  ageGroup: "ADULT" | "CHILD";
  dateOfBirth: string;
  nationality: string;
};
const blank: Draft = { fullName: "", ageGroup: "ADULT", dateOfBirth: "", nationality: "BD" };

/** People the customer often travels with; offered as suggestions at checkout. */
export function TravellersManager({ items, csrfToken }: { items: Traveller[]; csrfToken: string }) {
  const router = useRouter();
  const tr = useTranslations("profile");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(t: Traveller | "new") {
    setError(null);
    setEditing(t === "new" ? "new" : t.id);
    setDraft(
      t === "new"
        ? blank
        : {
            fullName: t.fullName,
            ageGroup: t.ageGroup,
            dateOfBirth: t.dateOfBirth ?? "",
            nationality: t.nationality ?? "",
          },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      fullName: draft.fullName,
      ageGroup: draft.ageGroup,
      dateOfBirth: draft.dateOfBirth || null,
      nationality: draft.nationality.trim() || null,
    };
    const result =
      editing === "new"
        ? await browserApi.POST("/api/v1/me/travellers", { headers: csrf(csrfToken), body })
        : await browserApi.PUT("/api/v1/me/travellers/{id}", {
            params: { path: { id: editing! } },
            headers: csrf(csrfToken),
            body,
          });
    setBusy(false);
    if (!result.response.ok) {
      setError(problemMessage(result.error));
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(t: Traveller) {
    if (!window.confirm(tr("removeConfirm", { name: t.fullName }))) return;
    await browserApi.DELETE("/api/v1/me/travellers/{id}", {
      params: { path: { id: t.id } },
      headers: csrf(csrfToken),
    });
    router.refresh();
  }

  return (
    <section className="panel p-5 md:p-6" aria-labelledby="trav-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="trav-h" className="text-[1rem] font-semibold">
            {tr("travellers")}
          </h2>
          <p className="mt-1 text-[0.84rem] text-ink-2">{tr("travellersIntro")}</p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => open("new")}
            className={buttonClass("outline", "sm")}
          >
            <Icon name="plus" className="size-4" /> {tr("addTraveller")}
          </button>
        )}
      </div>
      {editing !== null && (
        <form
          onSubmit={save}
          className="mt-4 grid gap-3 rounded-[14px] border border-primary/50 bg-primary-soft/40 p-4 md:grid-cols-4"
        >
          <TextField
            label={tr("fullNameId")}
            value={draft.fullName}
            onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
          />
          <SelectField
            label={tr("ageGroup")}
            value={draft.ageGroup}
            onChange={(e) => setDraft({ ...draft, ageGroup: e.target.value as Draft["ageGroup"] })}
          >
            <option value="ADULT">{tr("adult")}</option>
            <option value="CHILD">{tr("child")}</option>
          </SelectField>
          <TextField
            label={tr("dob")}
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
          />
          <TextField
            label={tr("nationality")}
            maxLength={2}
            placeholder="BD"
            value={draft.nationality}
            onChange={(e) => setDraft({ ...draft, nationality: e.target.value })}
          />
          {error && (
            <div className="md:col-span-4">
              <FormAlert>{error}</FormAlert>
            </div>
          )}
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" disabled={busy} className={buttonClass("primary", "sm")}>
              {busy ? tr("saving") : tr("saveTraveller")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={buttonClass("ghost", "sm")}
            >
              {tr("cancel")}
            </button>
          </div>
        </form>
      )}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && editing === null && (
          <li className="text-[0.9rem] text-ink-2">{tr("none")}</li>
        )}
        {items.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-rule px-4 py-3"
          >
            <span>
              <span className="block font-semibold">{t.fullName}</span>
              <span className="text-[0.8rem] text-ink-3">
                {t.ageGroup === "CHILD" ? tr("child") : tr("adult")}
                {t.nationality ? ` · ${t.nationality}` : ""}
              </span>
            </span>
            <span className="flex gap-2 text-[0.82rem] font-semibold">
              <button type="button" onClick={() => open(t)} className="text-primary-ink">
                {tr("edit")}
              </button>
              <button type="button" onClick={() => remove(t)} className="text-critical">
                {tr("remove")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
