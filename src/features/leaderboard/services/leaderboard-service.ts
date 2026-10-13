import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { predictions, profiles, roomMembers } from "@/db/schema";
import { rankEntries } from "../ranking";
import type { LeaderboardEntry } from "../types";

/** Every member of the room with their points over all the films, best first. */
export async function getRoomLeaderboard(db: Database, roomId: string): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      userId: roomMembers.userId,
      pseudo: profiles.pseudo,
      points: sql<number>`count(${predictions.id}) filter (where ${predictions.validated})`.mapWith(Number),
      judged: sql<number>`count(${predictions.id}) filter (where ${predictions.validated} is not null)`.mapWith(Number),
    })
    .from(roomMembers)
    .innerJoin(profiles, eq(profiles.id, roomMembers.userId))
    .leftJoin(predictions, and(eq(predictions.roomId, roomMembers.roomId), eq(predictions.userId, roomMembers.userId)))
    .where(eq(roomMembers.roomId, roomId))
    .groupBy(roomMembers.userId, profiles.pseudo);
  return rankEntries(rows);
}

/** The member's points per film, for the watched films history. */
export async function getPointsByMovie(
  db: Database,
  input: { roomId: string; userId: string },
): Promise<Map<number, number>> {
  const rows = await db
    .select({
      movieId: predictions.movieId,
      points: sql<number>`count(*) filter (where ${predictions.validated})`.mapWith(Number),
    })
    .from(predictions)
    .where(and(eq(predictions.roomId, input.roomId), eq(predictions.userId, input.userId)))
    .groupBy(predictions.movieId);
  return new Map(rows.map((row) => [row.movieId, row.points]));
}
