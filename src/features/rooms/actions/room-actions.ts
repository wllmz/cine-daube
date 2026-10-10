"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { createRoomSchema, inviteCodeSchema, roomIdSchema } from "../schemas";
import { createRoom, joinRoom, regenerateInviteCode } from "../services/room-service";
import type { RoomFormState } from "../types";

function readText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

export async function createRoomAction(
  _state: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const user = await getCurrentUser();
  const name = readText(formData, "name");
  const parsed = createRoomSchema.safeParse({ name });
  if (!parsed.success) {
    return { fieldErrors: { name: parsed.error.issues[0]?.message }, values: { name } };
  }

  const room = await createRoom(getDb(), { userId: user.id, name: parsed.data.name });
  redirect(`/rooms/${room.id}/invite`);
}

const JOIN_ERRORS = {
  not_found: "Aucune room avec ce code. Vérifie-le auprès de tes potes.",
  expired: "Ce code a expiré. Demande un nouveau lien à l'admin de la room.",
} as const;

export async function joinRoomAction(
  _state: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const user = await getCurrentUser();
  const code = readText(formData, "code");
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) {
    return { fieldErrors: { code: parsed.error.issues[0]?.message }, values: { code } };
  }

  const result = await joinRoom(getDb(), { userId: user.id, code: parsed.data });
  if (!("roomId" in result)) {
    return { error: JOIN_ERRORS[result.status], values: { code } };
  }
  redirect(`/rooms/${result.roomId}`);
}

export async function regenerateInviteAction(roomId: string): Promise<RoomFormState> {
  const user = await getCurrentUser();
  if (!roomIdSchema.safeParse(roomId).success) {
    return { error: "Room introuvable." };
  }

  const result = await regenerateInviteCode(getDb(), { roomId, userId: user.id });
  if (!result) {
    return { error: "Seul l'admin de la room peut changer le code." };
  }
  refresh();
  return {};
}
