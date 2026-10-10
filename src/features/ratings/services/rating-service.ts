import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { movieProviders, movies, profiles, ratings, roomMembers, roomMovies } from "@/db/schema";
import type { StreamingProvider } from "@/features/catalog/types";
import { summarize, type Scores } from "../scores";
import type { MemberRating, MovieDetail, RoomStats, WatchedMovie } from "../types";

async function providersByMovie(db: Database, movieIds: number[]): Promise<Map<number, StreamingProvider[]>> {
  const result = new Map<number, StreamingProvider[]>();
  if (movieIds.length === 0) return result;
  const rows = await db
    .select({ movieId: movieProviders.movieId, provider: movieProviders.provider })
    .from(movieProviders)
    .where(inArray(movieProviders.movieId, movieIds))
    .orderBy(asc(movieProviders.provider));
  for (const row of rows) {
    result.set(row.movieId, [...(result.get(row.movieId) ?? []), row.provider]);
  }
  return result;
}

const watchedColumns = {
  tmdbId: movies.tmdbId,
  title: movies.title,
  releaseYear: movies.releaseYear,
  runtimeMinutes: movies.runtimeMinutes,
  posterPath: movies.posterPath,
  watchedAt: roomMovies.createdAt,
};

/** Films the room watched (accepted at the roulette), most recent first, with their scores. */
export async function listWatchedMovies(db: Database, roomId: string, userId: string): Promise<WatchedMovie[]> {
  const watched = await db
    .select(watchedColumns)
    .from(roomMovies)
    .innerJoin(movies, eq(movies.tmdbId, roomMovies.movieId))
    .where(and(eq(roomMovies.roomId, roomId), eq(roomMovies.status, "watched")))
    .orderBy(desc(roomMovies.createdAt));
  if (watched.length === 0) return [];

  const [roomRatings, providers] = await Promise.all([
    db
      .select({
        movieId: ratings.movieId,
        userId: ratings.userId,
        humour: ratings.humour,
        scenario: ratings.scenario,
        acting: ratings.acting,
      })
      .from(ratings)
      .where(eq(ratings.roomId, roomId)),
    providersByMovie(db, watched.map((movie) => movie.tmdbId)),
  ]);

  return watched.map((movie) => {
    const movieRatings = roomRatings.filter((rating) => rating.movieId === movie.tmdbId);
    return {
      ...movie,
      providers: providers.get(movie.tmdbId) ?? [],
      summary: summarize(movieRatings),
      ratedByMe: movieRatings.some((rating) => rating.userId === userId),
    };
  });
}

/**
 * Room-level numbers for the "Films vus" header, from the watched list
 * (most recent first).
 * - Room average: mean of the films' averages, each rated film weighs the same.
 * - Acting bonus: mean of every bonus given, each bonus weighs the same.
 * - Navet d'Or: lowest film average; on a tie, the most recently watched.
 */
export function computeRoomStats(watched: WatchedMovie[]): RoomStats {
  const rated = watched.flatMap((movie) =>
    movie.summary.average === null ? [] : [{ movie, average: movie.summary.average }],
  );
  const worst = rated.reduce<(typeof rated)[number] | null>(
    (current, entry) => (current === null || entry.average < current.average ? entry : current),
    null,
  );

  let actingSum = 0;
  let actingCount = 0;
  for (const movie of watched) {
    if (movie.summary.acting === null) continue;
    const given = movie.summary.actingCount;
    actingSum += movie.summary.acting * given;
    actingCount += given;
  }

  return {
    watchedCount: watched.length,
    roomAverage: rated.length > 0 ? rated.reduce((sum, entry) => sum + entry.average, 0) / rated.length : null,
    actingAverage: actingCount > 0 ? actingSum / actingCount : null,
    navet: worst?.movie ?? null,
  };
}

/** A watched film with every member's rating, or null if the room did not watch it. */
export async function getMovieDetail(
  db: Database,
  input: { roomId: string; movieId: number; userId: string },
): Promise<MovieDetail | null> {
  const [movie] = await db
    .select({ ...watchedColumns, overview: movies.overview })
    .from(roomMovies)
    .innerJoin(movies, eq(movies.tmdbId, roomMovies.movieId))
    .where(
      and(eq(roomMovies.roomId, input.roomId), eq(roomMovies.movieId, input.movieId), eq(roomMovies.status, "watched")),
    )
    .limit(1);
  if (!movie) return null;

  const [members, providers] = await Promise.all([
    db
      .select({
        userId: roomMembers.userId,
        pseudo: profiles.pseudo,
        humour: ratings.humour,
        scenario: ratings.scenario,
        acting: ratings.acting,
      })
      .from(roomMembers)
      .innerJoin(profiles, eq(profiles.id, roomMembers.userId))
      .leftJoin(
        ratings,
        and(
          eq(ratings.roomId, roomMembers.roomId),
          eq(ratings.userId, roomMembers.userId),
          eq(ratings.movieId, input.movieId),
        ),
      )
      .where(eq(roomMembers.roomId, input.roomId))
      .orderBy(asc(roomMembers.joinedAt)),
    providersByMovie(db, [input.movieId]),
  ]);

  const memberRatings: MemberRating[] = members.map((member) => ({
    userId: member.userId,
    pseudo: member.pseudo,
    scores:
      member.humour === null || member.scenario === null
        ? null
        : { humour: member.humour, scenario: member.scenario, acting: member.acting },
  }));
  const given = memberRatings.flatMap((member) => (member.scores ? [member.scores] : []));

  return {
    ...movie,
    providers: providers.get(input.movieId) ?? [],
    summary: summarize(given),
    ratings: memberRatings,
    myScores: memberRatings.find((member) => member.userId === input.userId)?.scores ?? null,
  };
}

/**
 * Creates or updates a member's rating. The database only accepts it for a
 * member of the room and a film the room watched.
 */
export async function saveRating(
  db: Database,
  input: { roomId: string; movieId: number; userId: string; scores: Scores },
): Promise<void> {
  const values = {
    roomId: input.roomId,
    movieId: input.movieId,
    userId: input.userId,
    humour: input.scores.humour,
    scenario: input.scores.scenario,
    acting: input.scores.acting,
  };
  await db
    .insert(ratings)
    .values(values)
    .onConflictDoUpdate({
      target: [ratings.roomId, ratings.movieId, ratings.userId],
      set: { humour: values.humour, scenario: values.scenario, acting: values.acting, updatedAt: new Date() },
    });
}
