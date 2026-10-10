"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "../actions/auth-actions";
import type { AuthFormState } from "../types";

export function SignOutButton() {
  const [state, formAction, pending] = useActionState<AuthFormState>(signOut, {});

  return (
    <form action={formAction} className="flex flex-col items-end">
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-accent-strong">
          {state.error}
        </p>
      )}
    </form>
  );
}
