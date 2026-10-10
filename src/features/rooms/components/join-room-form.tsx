"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { joinRoomAction } from "../actions/room-actions";
import type { RoomFormState } from "../types";

type JoinRoomFormProps = {
  /** Known code (invite link): only the confirm button is shown. */
  code?: string;
  submitLabel?: string;
};

export function JoinRoomForm({ code, submitLabel = "Rejoindre" }: JoinRoomFormProps) {
  const [state, formAction, pending] = useActionState<RoomFormState, FormData>(joinRoomAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {code ? (
        <input type="hidden" name="code" value={code} />
      ) : (
        <TextField
          label="Code d'invitation"
          name="code"
          placeholder="DAUBE-7K2QXM"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          hint="Ou colle directement le lien reçu."
          defaultValue={state.values?.code}
          error={state.fieldErrors?.code}
          autoFocus
          required
        />
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Connexion à la room…" : submitLabel}
      </Button>
    </form>
  );
}
