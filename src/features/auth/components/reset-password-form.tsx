"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { updatePassword } from "../actions/auth-actions";
import { useFocusFirstInvalid } from "../hooks/use-focus-first-invalid";
import { PASSWORD_MIN_LENGTH } from "../schemas";
import type { AuthFormState } from "../types";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(updatePassword, {});
  const formRef = useFocusFirstInvalid(state.fieldErrors);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <TextField
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum.`}
        error={state.fieldErrors?.password}
        required
      />
      <TextField
        label="Confirme-le"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirmation}
        required
      />
      <Button type="submit" disabled={pending} className="mt-2.5">
        {pending ? "Enregistrement…" : "Changer mon mot de passe"}
      </Button>
    </form>
  );
}
