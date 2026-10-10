"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { authErrorMessage } from "../errors";
import { AFTER_SIGN_IN_PATH, SIGN_IN_PATH, safeNextPath } from "../redirect";
import {
  newPasswordSchema,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
} from "../schemas";
import type { AuthFieldErrors, AuthFormState } from "../types";

/** First message for each top-level field. */
function firstFieldErrors(error: z.ZodError): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function readText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

function callbackUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = readText(formData, "email");
  const parsed = signInSchema.safeParse({ email, password: readText(formData, "password") });
  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error), values: { email } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: authErrorMessage(error), values: { email } };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: readText(formData, "email"), pseudo: readText(formData, "pseudo") };
  const parsed = signUpSchema.safeParse({ ...values, password: readText(formData, "password") });
  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error), values };
  }

  const { email, password, pseudo } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the on_auth_user_created trigger to create the profile.
      data: { pseudo },
      emailRedirectTo: callbackUrl(await requestOrigin(), AFTER_SIGN_IN_PATH),
    },
  });
  if (error) {
    return { error: authErrorMessage(error), values };
  }

  // Email confirmation disabled: the user is signed in right away.
  if (data.session) {
    redirect(AFTER_SIGN_IN_PATH);
  }

  return {
    success: `C'est presque bon ! Clique sur le lien envoyé à ${email} pour activer ton compte.`,
  };
}

export async function requestPasswordReset(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readText(formData, "email");
  const parsed = passwordResetRequestSchema.safeParse({ email });
  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error), values: { email } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl(await requestOrigin(), "/reset-password"),
  });
  // Only rate limits are surfaced: the answer must not reveal whether an account exists.
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return { error: authErrorMessage(error), values: { email } };
  }

  return {
    success: `Si un compte existe pour ${parsed.data.email}, un lien pour changer ton mot de passe vient de partir.`,
  };
}

export async function updatePassword(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({
    password: readText(formData, "password"),
    confirmation: readText(formData, "confirmation"),
  });
  if (!parsed.success) {
    return { fieldErrors: firstFieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: authErrorMessage(error) };
  }

  redirect(AFTER_SIGN_IN_PATH);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
