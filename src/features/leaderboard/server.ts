import "server-only";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { settleExpired } from "@/features/predictions/server";
import { requireRoomMember } from "@/features/rooms/server";
import { getPointsByMovie, getRoomLeaderboard } from "./services/leaderboard-service";
import type { LeaderboardEntry } from "./types";

/** The room's ranking, with predictions past their voting time judged first. */
export async function getLeaderboard(roomId: string): Promise<{ entries: LeaderboardEntry[]; currentUserId: string }> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  await settleExpired(room.id);
  return { entries: await getRoomLeaderboard(getDb(), room.id), currentUserId: user.id };
}

/** The current member's points per film in this room. */
export async function getMyPointsByMovie(roomId: string): Promise<Map<number, number>> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  await settleExpired(room.id);
  return getPointsByMovie(getDb(), { roomId: room.id, userId: user.id });
}
