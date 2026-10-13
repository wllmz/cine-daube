"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { requireRoomMember } from "@/features/rooms/server";
import { castVote, markSeenAndRelaunch, startSpin } from "../services/roulette-service";
import type { RouletteActionState } from "../types";

const idSchema = z.uuid();
// Rooms are groups of friends; the bound only prevents absurd payloads.
const votersSchema = z.array(idSchema).min(1).max(50);
const voteSchema = z.enum(["yes", "no"]);

const EMPTY_POOL = "Plus aucune comédie à tirer : vous avez tout vu, tout recalé ces dernières 24 h, ou il ne reste que des films trop mal notés.";
const CLOSED = "Ce vote est déjà terminé.";
const NOT_VOTER = "Tu n'étais pas coché pour ce vote.";
const FAILED = "Oups, ça a coincé. Recharge la page et réessaie.";

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
  const voterIds = votersSchema.safeParse(formData.getAll("voters"));
  if (!voterIds.success) {
    return { error: "Coche au moins une personne présente ce soir." };
  }

  try {
    const result = await startSpin(getDb(), { roomId: room.id, userId: user.id, voterIds: voterIds.data });
    refresh();
    if (result.status === "empty_pool") return { error: EMPTY_POOL };
    if (result.status === "already_voting") {
      return { error: "Un pote vient de lancer la roue : le vote en cours s'affiche." };
    }
    return {};
  } catch (error) {
    // Typically a voter who left the room meanwhile (membership foreign key).
    console.error("startSpin failed", error);
    return { error: FAILED };
  }
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

  try {
    const result = await castVote(getDb(), {
      spinId: parsedSpin.data,
      roomId: room.id,
      userId: user.id,
      vote: parsedVote.data,
    });
    refresh();
    if (result.status === "closed") return { error: CLOSED };
    if (result.status === "not_voter") return { error: NOT_VOTER };
    // A tie spins again; null means no film was left to draw.
    if ("nextSpinId" in result && result.nextSpinId === null) return { error: EMPTY_POOL };
    return {};
  } catch (error) {
    console.error("castVote failed", error);
    return { error: FAILED };
  }
}

export async function markSeenAction(roomId: string, spinId: string): Promise<RouletteActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedSpin = idSchema.safeParse(spinId);
  if (!parsedSpin.success) return { error: "Film invalide." };

  try {
    const result = await markSeenAndRelaunch(getDb(), { spinId: parsedSpin.data, roomId: room.id, userId: user.id });
    refresh();
    if (!("spinId" in result)) return { error: result.status === "closed" ? CLOSED : NOT_VOTER };
    if (result.spinId === null) return { error: EMPTY_POOL };
    return {};
  } catch (error) {
    console.error("markSeen failed", error);
    return { error: FAILED };
  }
}
