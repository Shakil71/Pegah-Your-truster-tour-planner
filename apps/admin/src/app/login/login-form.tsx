"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LoginRequestSchema } from "@pegah/contracts";
import { FormAlert, Icon, TextField, buttonClass, zodResolver } from "@pegah/ui";
import { browserApi, problemMessage } from "@/lib/api-browser";

type Values = { email: string; password: string };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(LoginRequestSchema) });

  async function onSubmit(values: Values) {
    setError(null);
    const { error: problem, response } = await browserApi.POST("/api/v1/staff/auth/login", {
      body: values,
    });
    if (!response.ok) {
      setError(
        response.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : problemMessage(problem, "Sign-in failed. Please try again."),
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-5" noValidate>
      <TextField
        label="Work email"
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      {error && <FormAlert>{error}</FormAlert>}
      <button type="submit" disabled={isSubmitting} className={buttonClass("primary", "lg")}>
        {isSubmitting ? "Signing in…" : "Sign in"}
        {!isSubmitting && <Icon name="arrowRight" className="size-[18px]" />}
      </button>
    </form>
  );
}
