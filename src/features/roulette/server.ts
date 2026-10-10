import "server-only";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { getRoomMembers, requireRoomMember } from "@/features/rooms/server";
import type { RoomDetails, RoomMember } from "@/features/rooms/types";
import { getLatestSpin } from "./services/roulette-service";
import type { CurrentSpin } from "./types";

export type RouletteState = {
  room: RoomDetails;
  members: RoomMember[];
  currentUserId: string;
  spin: CurrentSpin | null;
};

/** Everything the roulette screen needs, for a member of the room only. */
export async function getRouletteState(roomId: string): Promise<RouletteState> {
  const [room, members, user] = await Promise.all([
    requireRoomMember(roomId),
    getRoomMembers(roomId),
    getCurrentUser(),
  ]);
  const spin = await getLatestSpin(getDb(), room.id);
  return { room, members, currentUserId: user.id, spin };
}

/** The latest spin of a room the current user belongs to (for the lobby). */
export async function getLatestRoomSpin(roomId: string): Promise<CurrentSpin | null> {
  const room = await requireRoomMember(roomId);
  return getLatestSpin(getDb(), room.id);
}
