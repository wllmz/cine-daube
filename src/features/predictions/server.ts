import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { movieIdSchema } from "@/features/ratings/schemas";
import { requireRoomMember } from "@/features/rooms/server";
import { findFilmInProgress, getPredictionBoard, listPendingFinishVotes } from "./services/prediction-service";
import type { FilmInProgress, PendingFinishVote, PredictionBoard } from "./types";

/** Votes expire, so these reads depend on the current time: always at request time. */
async function requestTime(): Promise<Date> {
  await connection();
  return new Date();
}

/** The film's predictions as the current member may see them, or a 404. */
export async function requirePredictionBoard(roomId: string, movieId: string): Promise<PredictionBoard> {
  const parsed = movieIdSchema.safeParse(movieId);
  if (!parsed.success) notFound();
  const [room, user, now] = await Promise.all([requireRoomMember(roomId), getCurrentUser(), requestTime()]);
  const board = await getPredictionBoard(getDb(), { roomId: room.id, movieId: parsed.data, userId: user.id, now });
  if (!board) notFound();
  return board;
}

/** "Film terminé ?" votes waiting for the current member. */
export async function getPendingFinishVotes(roomId: string): Promise<PendingFinishVote[]> {
  const [room, user, now] = await Promise.all([requireRoomMember(roomId), getCurrentUser(), requestTime()]);
  return listPendingFinishVotes(getDb(), { roomId: room.id, userId: user.id, now });
}

export async function getFilmInProgress(roomId: string): Promise<FilmInProgress | null> {
  const room = await requireRoomMember(roomId);
  return findFilmInProgress(getDb(), room.id);
}
