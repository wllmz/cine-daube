"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { requestPasswordReset } from "../actions/auth-actions";
import type { AuthFormState } from "../types";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.success) {
    return <FormAlert tone="success">{state.success}</FormAlert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="toi@exemple.fr"
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        required
      />
      <Button type="submit" disabled={pending} className="mt-2.5">
        {pending ? "Envoi…" : "Recevoir un lien"}
      </Button>
    </form>
  );
}
