"use server";

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

// Email links are built by the Supabase email templates from the project's
// Site URL ({{ .SiteURL }}/auth/confirm?token_hash=...), never from request
// headers, so a forged Host header cannot redirect them.

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
    // Read by the on_auth_user_created trigger to create the profile.
    options: { data: { pseudo } },
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
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
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

  // A reset often follows a compromise: end every other session. The password
  // is already changed, so a failure here must not block the user.
  await supabase.auth.signOut({ scope: "others" });

  redirect(AFTER_SIGN_IN_PATH);
}

/** Signs out this device only, and reports failures instead of a silent no-op. */
export async function signOut(): Promise<AuthFormState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    return { error: "Impossible de te déconnecter, réessaie." };
  }
  redirect(SIGN_IN_PATH);
}
