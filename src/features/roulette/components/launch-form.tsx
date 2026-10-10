"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import type { RoomMember } from "@/features/rooms/types";
import { startSpinAction } from "../actions/roulette-actions";
import type { RouletteActionState } from "../types";

type LaunchFormProps = {
  roomId: string;
  members: RoomMember[];
  label?: string;
};

/** "Qui est là ce soir ?": the checked members are the voters of the spin. */
export function LaunchForm({ roomId, members, label = "Lancer la roulette" }: LaunchFormProps) {
  const [state, formAction, pending] = useActionState<RouletteActionState, FormData>(
    startSpinAction.bind(null, roomId),
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1.5 text-[13px] font-semibold text-muted">Qui est là ce soir ?</legend>
        {members.map((member) => (
          <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-subtle">
            <input type="checkbox" name="voters" value={member.id} defaultChecked className="size-5 accent-accent" />
            <Avatar id={member.id} pseudo={member.pseudo} size="sm" />
            <span className="text-[15px] font-semibold">{member.pseudo}</span>
          </label>
        ))}
      </fieldset>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Ça tourne…" : label}
      </Button>
    </form>
  );
}
