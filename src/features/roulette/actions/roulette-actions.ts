"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { requireRoomMember } from "@/features/rooms/server";
import { castVote, markSeenAndRelaunch, startSpin } from "../services/roulette-service";
import type { RouletteActionState } from "../types";

const idSchema = z.uuid();
const voteSchema = z.enum(["yes", "no"]);

const EMPTY_POOL = "Plus aucune comédie à tirer : vous avez tout vu (ou presque) !";
const CLOSED = "Ce vote est déjà terminé.";

/** Resolves the room (404 for non-members) and the current user. */
async function memberContext(roomId: string) {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  return { room, user };
}

export async function startSpinAction(
  roomId: string,
  _state: RouletteActionState,
  formData: FormData,
): Promise<RouletteActionState> {
  const { room, user } = await memberContext(roomId);
  const voterIds = z.array(idSchema).safeParse(formData.getAll("voters"));
  if (!voterIds.success || voterIds.data.length === 0) {
    return { error: "Coche au moins une personne présente ce soir." };
  }

  try {
    const result = await startSpin(getDb(), { roomId: room.id, userId: user.id, voterIds: voterIds.data });
    if (result.status === "empty_pool") return { error: EMPTY_POOL };
  } catch (error) {
    // Typically a voter who left the room meanwhile (membership foreign key).
    console.error("startSpin failed", error);
    return { error: "Impossible de lancer la roulette, recharge la page et réessaie." };
  }
  refresh();
  return {};
}

export async function castVoteAction(
  roomId: string,
  spinId: string,
  vote: string,
): Promise<RouletteActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedSpin = idSchema.safeParse(spinId);
  const parsedVote = voteSchema.safeParse(vote);
  if (!parsedSpin.success || !parsedVote.success) return { error: "Vote invalide." };

  const result = await castVote(getDb(), {
    spinId: parsedSpin.data,
    roomId: room.id,
    userId: user.id,
    vote: parsedVote.data,
  });
  refresh();
  if (result.status === "closed") return { error: CLOSED };
  if (result.status === "not_voter") return { error: "Tu ne fais pas partie de ce vote." };
  // A tie spins again; null means no film was left to draw.
  if ("nextSpinId" in result && result.nextSpinId === null) return { error: EMPTY_POOL };
  return {};
}

export async function markSeenAction(roomId: string, spinId: string): Promise<RouletteActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedSpin = idSchema.safeParse(spinId);
  if (!parsedSpin.success) return { error: "Film invalide." };

  const result = await markSeenAndRelaunch(getDb(), { spinId: parsedSpin.data, roomId: room.id, userId: user.id });
  refresh();
  if (result.status === "closed") return { error: CLOSED };
  if (result.spinId === null) return { error: EMPTY_POOL };
  return {};
}
