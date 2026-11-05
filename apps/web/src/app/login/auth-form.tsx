"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LoginRequestSchema, RegisterRequestSchema } from "@pegah/contracts";
import { FormAlert, TextField, buttonClass, cx, zodResolver } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

type Mode = "login" | "register";
type Values = { email: string; password: string; fullName?: string; phone?: string };

export function AuthForm({ next, initialMode }: { next: string; initialMode: Mode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(mode === "login" ? LoginRequestSchema : RegisterRequestSchema),
  });

  async function onSubmit(values: Values) {
    setError(null);
    const result =
      mode === "login"
        ? await browserApi.POST("/api/v1/auth/login", {
            body: { email: values.email, password: values.password },
          })
        : await browserApi.POST("/api/v1/auth/register", {
            body: {
              email: values.email,
              password: values.password,
              fullName: values.fullName ?? "",
              ...(values.phone ? { phone: values.phone } : {}),
            },
          });
    if (!result.response.ok) {
      setError(result.response.status === 429 ? t("tooMany") : problemMessage(result.error));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div>
      <div
        className="flex rounded-full border border-rule bg-paper p-1"
        role="tablist"
        aria-label={t("account")}
      >
        {(
          [
            ["login", t("signIn")],
            ["register", t("createAccount")],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cx(
              "flex-1 cursor-pointer rounded-full px-4 py-2 text-[0.9rem] font-semibold",
              mode === m ? "bg-ink text-card" : "text-ink-2 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <h1 className="mt-8 font-display text-[2rem] font-medium leading-tight">
        {mode === "login" ? t("welcomeBack") : t("createTitle")}
      </h1>
      <p className="mt-1 text-ink-2">{mode === "login" ? t("signInIntro") : t("registerIntro")}</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate key={mode}>
        {mode === "register" && (
          <TextField
            label={t("fullName")}
            autoComplete="name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
        )}
        <TextField
          label={t("email")}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        {mode === "register" && (
          <TextField
            label={t("mobileOptional")}
            type="tel"
            autoComplete="tel"
            placeholder="+8801XXXXXXXXX"
            error={errors.phone?.message}
            {...register("phone", { setValueAs: (v: string) => v?.trim() || undefined })}
          />
        )}
        <TextField
          label={t("password")}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          hint={mode === "register" ? t("passwordHint") : undefined}
          error={errors.password?.message}
          {...register("password")}
        />
        {mode === "login" && (
          <Link
            href="/forgot-password"
            className="justify-self-start text-[0.86rem] font-semibold text-primary-ink"
          >
            {t("forgot")}
          </Link>
        )}
        {error && <FormAlert>{error}</FormAlert>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonClass("primary", "md", "h-12")}
        >
          {isSubmitting ? t("pleaseWait") : mode === "login" ? t("signIn") : t("createAccount")}
        </button>
      </form>
    </div>
  );
}
