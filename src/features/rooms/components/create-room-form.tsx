"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { TextField } from "@/components/ui/text-field";
import { createRoomAction } from "../actions/room-actions";
import { ROOM_NAME_MAX_LENGTH } from "../schemas";
import type { RoomFormState } from "../types";

export function CreateRoomForm() {
  const [state, formAction, pending] = useActionState<RoomFormState, FormData>(createRoomAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <TextField
        label="Nom de la room"
        name="name"
        placeholder="Les Nanardeurs"
        maxLength={ROOM_NAME_MAX_LENGTH}
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
        autoFocus
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer la room"}
      </Button>
    </form>
  );
}
