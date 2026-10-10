"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { signUp } from "../actions/auth-actions";
import { PASSWORD_MIN_LENGTH, PSEUDO_MAX_LENGTH } from "../schemas";
import type { AuthFormState } from "../types";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  if (state.success) {
    return <FormAlert tone="success">{state.success}</FormAlert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <TextField
        label="Pseudo"
        name="pseudo"
        autoComplete="nickname"
        placeholder="Le Roi du Nanar"
        maxLength={PSEUDO_MAX_LENGTH}
        defaultValue={state.values?.pseudo}
        error={state.fieldErrors?.pseudo}
        required
      />
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
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={`${PASSWORD_MIN_LENGTH} caractères minimum`}
        error={state.fieldErrors?.password}
        required
      />
      <Button type="submit" disabled={pending} className="mt-2.5">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
