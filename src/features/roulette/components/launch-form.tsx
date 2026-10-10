"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { useRoomPresence } from "@/features/realtime";
import type { RoomMember } from "@/features/rooms/types";
import { startSpinAction } from "../actions/roulette-actions";
import type { RouletteActionState } from "../types";

type LaunchFormProps = {
  roomId: string;
  members: RoomMember[];
  label?: string;
};

/**
 * "Qui est là ce soir ?": the checked members are the voters of the spin.
 * Members with the room open are pre-checked; everyone stays editable (one
 * phone for the whole couch is fine).
 */
export function LaunchForm(props: LaunchFormProps) {
  const { onlineIds, ready } = useRoomPresence();
  // Defaults are applied once presence is known: remount at that moment.
  const online = ready ? props.members.filter((member) => onlineIds.has(member.id)).map((member) => member.id) : [];
  const defaults = new Set(online.length > 0 ? online : props.members.map((member) => member.id));

  return <LaunchFormFields key={ready ? "presence" : "initial"} {...props} defaults={defaults} onlineIds={onlineIds} />;
}

function LaunchFormFields({
  roomId,
  members,
  label = "Lancer la roulette",
  defaults,
  onlineIds,
}: LaunchFormProps & { defaults: ReadonlySet<string>; onlineIds: ReadonlySet<string> }) {
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
            <input
              type="checkbox"
              name="voters"
              value={member.id}
              defaultChecked={defaults.has(member.id)}
              className="size-5 accent-accent"
            />
            <Avatar id={member.id} pseudo={member.pseudo} size="sm" />
            <span className="flex-1 text-[15px] font-semibold">{member.pseudo}</span>
            {onlineIds.has(member.id) && (
              <span className="flex items-center gap-1 text-xs font-semibold text-success">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                en ligne
              </span>
            )}
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
