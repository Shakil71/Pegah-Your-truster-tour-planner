"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LoginRequestSchema, RegisterRequestSchema } from "@pegah/contracts";
import { FormAlert, TextField, buttonClass, cx, zodResolver } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

type Mode = "login" | "register";
type Values = { email: string; password: string; fullName?: string; phone?: string };

export function AuthForm({ next, initialMode }: { next: string; initialMode: Mode }) {
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
      setError(
        result.response.status === 429
          ? "Too many attempts. Please wait a minute."
          : problemMessage(result.error),
      );
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
        aria-label="Account"
      >
        {(
          [
            ["login", "Sign in"],
            ["register", "Create account"],
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
        {mode === "login" ? "Welcome back" : "Create your Pegah account"}
      </h1>
      <p className="mt-1 text-ink-2">
        {mode === "login"
          ? "Sign in to hold rooms and seats and see your trips."
          : "It takes a minute. We only ask for what a booking needs."}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate key={mode}>
        {mode === "register" && (
          <TextField
            label="Full name"
            autoComplete="name"
            error={errors.fullName?.message}
            {...register("fullName")}
          />
        )}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        {mode === "register" && (
          <TextField
            label="Mobile (optional)"
            type="tel"
            autoComplete="tel"
            placeholder="+8801XXXXXXXXX"
            error={errors.phone?.message}
            {...register("phone", { setValueAs: (v: string) => v?.trim() || undefined })}
          />
        )}
        <TextField
          label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          hint={
            mode === "register" ? "At least 10 characters. A short phrase works well." : undefined
          }
          error={errors.password?.message}
          {...register("password")}
        />
        {error && <FormAlert>{error}</FormAlert>}
        <button
          type="submit"
          disabled={isSubmitting}
          className={buttonClass("primary", "md", "h-12")}
        >
          {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
