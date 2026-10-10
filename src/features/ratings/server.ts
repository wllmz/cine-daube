import "server-only";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { requireRoomMember } from "@/features/rooms/server";
import { movieIdSchema } from "./schemas";
import { computeRoomStats, getMovieDetail, listWatchedMovies } from "./services/rating-service";
import type { MovieDetail, RoomStats, WatchedMovie } from "./types";

export async function getWatchedMovies(roomId: string): Promise<{ movies: WatchedMovie[]; stats: RoomStats }> {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  const movies = await listWatchedMovies(getDb(), room.id, user.id);
  return { movies, stats: computeRoomStats(movies) };
}

/** A film the room watched, or a 404 (unknown id, not watched, or not a member). */
export async function requireWatchedMovie(roomId: string, movieId: string): Promise<MovieDetail> {
  const parsed = movieIdSchema.safeParse(movieId);
  if (!parsed.success) notFound();
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  const detail = await getMovieDetail(getDb(), { roomId: room.id, movieId: parsed.data, userId: user.id });
  if (!detail) notFound();
  return detail;
}

/** The most recent watched film the current user has not rated yet. */
export async function getNextToRate(roomId: string): Promise<WatchedMovie | null> {
  const { movies } = await getWatchedMovies(roomId);
  return movies.find((movie) => !movie.ratedByMe) ?? null;
}
