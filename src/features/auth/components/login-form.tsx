"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { signIn } from "../actions/auth-actions";
import { useFocusFirstInvalid } from "../hooks/use-focus-first-invalid";
import type { AuthFormState } from "../types";

const LINK_ERROR = "Ce lien a expiré ou a déjà servi. Reconnecte-toi ou demande-en un nouveau.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  const formRef = useFocusFirstInvalid(state.fieldErrors);
  const hasSubmitted = Object.keys(state).length > 0;
  const linkError = !hasSubmitted && searchParams.get("error") === "link" ? LINK_ERROR : undefined;
  const error = state.error ?? linkError;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3.5" noValidate>
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      {error && <FormAlert tone="error">{error}</FormAlert>}
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
        autoComplete="current-password"
        error={state.fieldErrors?.password}
        required
      />
      <Button type="submit" disabled={pending} className="mt-2.5">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <Link
        href="/forgot-password"
        className="self-center p-3 text-sm font-semibold text-accent hover:text-accent-strong"
      >
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
