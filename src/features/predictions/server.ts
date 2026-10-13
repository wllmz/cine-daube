import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { movieIdSchema } from "@/features/ratings/schemas";
import { requireRoomMember } from "@/features/rooms/server";
import {
  findFilmInProgress,
  getPredictionBoard,
  listPendingFinishVotes,
  settleExpiredFinishVotes,
} from "./services/prediction-service";
import { findFilmToJudge, settleExpiredPredictions } from "./services/judging-service";
import type { FilmInProgress, FilmToJudge, PendingFinishVote, PredictionBoard } from "./types";

/**
 * Votes expire, so these reads depend on the current time (always at request
 * time) and first settle the votes past their delay: the room sees a film
 * end on time without anyone clicking again. Once per request: the layout
 * and the page both read through here.
 */
export const settleExpired = cache(async (roomId: string): Promise<Date> => {
  await connection();
  const now = new Date();
  await settleExpiredFinishVotes(getDb(), { roomId, now });
  await settleExpiredPredictions(getDb(), { roomId, now });
  return now;
});

/** The film's predictions as the current member may see them, or a 404. */
export async function requirePredictionBoard(roomId: string, movieId: string): Promise<PredictionBoard> {
  const parsed = movieIdSchema.safeParse(movieId);
  if (!parsed.success) notFound();
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  const now = await settleExpired(room.id);
  const board = await getPredictionBoard(getDb(), { roomId: room.id, movieId: parsed.data, userId: user.id, now });
  if (!board) notFound();
  return board;
}

/** "Film terminé ?" votes waiting for the current member. */
export async function getPendingFinishVotes(roomId: string): Promise<PendingFinishVote[]> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  await settleExpired(room.id);
  return listPendingFinishVotes(getDb(), { roomId: room.id, userId: user.id, now: new Date() });
}

export async function getFilmInProgress(roomId: string): Promise<FilmInProgress | null> {
  const room = await requireRoomMember(roomId);
  await settleExpired(room.id);
  return findFilmInProgress(getDb(), room.id);
}

/** The latest finished film whose predictions wait for the current member's votes. */
export async function getFilmToJudge(roomId: string): Promise<FilmToJudge | null> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  const now = await settleExpired(room.id);
  return findFilmToJudge(getDb(), { roomId: room.id, userId: user.id, now });
}
