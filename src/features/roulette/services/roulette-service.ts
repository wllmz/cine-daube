import "server-only";
import { and, asc, desc, eq, exists, gt, notExists, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { movieProviders, movies, profiles, roomMovies, spinVotes, spins } from "@/db/schema";
import { resolveVote } from "../vote";
import type {
  CastVoteResult,
  CurrentSpin,
  MarkSeenResult,
  StartSpinResult,
  VoteValue,
} from "../types";

// A film the room just rejected should not come straight back.
const REJECTED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Draws a random film still in the room's pool: available on a platform,
 * never watched or marked "déjà vu" by the room, not rejected recently.
 */
async function pickMovie(db: Database, roomId: string, now: Date): Promise<number | null> {
  const available = db
    .select({ one: sql`1` })
    .from(movieProviders)
    .where(eq(movieProviders.movieId, movies.tmdbId));
  const alreadyInRoom = db
    .select({ one: sql`1` })
    .from(roomMovies)
    .where(and(eq(roomMovies.roomId, roomId), eq(roomMovies.movieId, movies.tmdbId)));
  const recentlyRejected = db
    .select({ one: sql`1` })
    .from(spins)
    .where(
      and(
        eq(spins.roomId, roomId),
        eq(spins.movieId, movies.tmdbId),
        // Ties are stored as rejected too: the tied film also sits out a day.
        eq(spins.status, "rejected"),
        gt(spins.resolvedAt, new Date(now.getTime() - REJECTED_COOLDOWN_MS)),
      ),
    );

  const [movie] = await db
    .select({ tmdbId: movies.tmdbId })
    .from(movies)
    .where(and(exists(available), notExists(alreadyInRoom), notExists(recentlyRejected)))
    .orderBy(sql`random()`)
    .limit(1);
  return movie?.tmdbId ?? null;
}

/** Inserts a voting spin and its voters. Returns null when nothing can be drawn. */
async function insertSpin(
  db: Database,
  input: { roomId: string; launchedBy: string; voterIds: string[]; now: Date },
): Promise<string | null> {
  // No voters left (they all left the room): a spin nobody can vote on would block the room.
  if (input.voterIds.length === 0) return null;
  const movieId = await pickMovie(db, input.roomId, input.now);
  if (movieId === null) return null;

  const [spin] = await db
    .insert(spins)
    .values({ roomId: input.roomId, movieId, launchedBy: input.launchedBy })
    .returning({ id: spins.id });
  if (!spin) throw new Error("Spin insert returned no row");

  await db
    .insert(spinVotes)
    .values(input.voterIds.map((userId) => ({ spinId: spin.id, roomId: input.roomId, userId })));
  return spin.id;
}

async function votingSpinId(db: Database, roomId: string): Promise<string | null> {
  const [spin] = await db
    .select({ id: spins.id })
    .from(spins)
    .where(and(eq(spins.roomId, roomId), eq(spins.status, "voting")))
    .limit(1);
  return spin?.id ?? null;
}

/**
 * Starts a roulette for the given voters (members present tonight).
 * Only one spin can be voted on per room: a concurrent launch returns it.
 */
export async function startSpin(
  db: Database,
  input: { roomId: string; userId: string; voterIds: string[]; now?: Date },
): Promise<StartSpinResult> {
  const voterIds = [...new Set(input.voterIds)];
  if (voterIds.length === 0) throw new Error("A spin needs at least one voter");

  const now = input.now ?? new Date();
  try {
    const spinId = await db.transaction(async (tx) => {
      // A spin whose voters all left can never be resolved: close it instead
      // of blocking the room forever.
      const hasVoters = tx
        .select({ one: sql`1` })
        .from(spinVotes)
        .where(eq(spinVotes.spinId, spins.id));
      await tx
        .update(spins)
        .set({ status: "rejected", resolvedAt: now })
        .where(and(eq(spins.roomId, input.roomId), eq(spins.status, "voting"), notExists(hasVoters)));

      return insertSpin(tx, { roomId: input.roomId, launchedBy: input.userId, voterIds, now });
    });
    return spinId ? { status: "started", spinId } : { status: "empty_pool" };
  } catch (error) {
    if (!isUniqueViolation(error, "spins_one_voting_per_room_idx")) throw error;
    const existing = await votingSpinId(db, input.roomId);
    if (!existing) throw error;
    return { status: "already_voting", spinId: existing };
  }
}

/** Locks the spin so concurrent votes resolve it exactly once. */
async function lockVotingSpin(db: Database, spinId: string, roomId: string) {
  const [spin] = await db
    .select({ id: spins.id, status: spins.status, movieId: spins.movieId })
    .from(spins)
    .where(and(eq(spins.id, spinId), eq(spins.roomId, roomId)))
    .for("update");
  return spin && spin.status === "voting" ? spin : null;
}

async function voterIdsOf(db: Database, spinId: string): Promise<string[]> {
  const rows = await db.select({ userId: spinVotes.userId }).from(spinVotes).where(eq(spinVotes.spinId, spinId));
  return rows.map((row) => row.userId);
}

/**
 * Records a vote (it can be changed until the spin is resolved) and resolves
 * the spin when a majority is reached. A tie relaunches with the same voters.
 */
export async function castVote(
  db: Database,
  input: { spinId: string; roomId: string; userId: string; vote: VoteValue; now?: Date },
): Promise<CastVoteResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const spin = await lockVotingSpin(tx, input.spinId, input.roomId);
    if (!spin) return { status: "closed" };

    const updated = await tx
      .update(spinVotes)
      .set({ vote: input.vote, votedAt: now })
      .where(and(eq(spinVotes.spinId, spin.id), eq(spinVotes.userId, input.userId)))
      .returning({ userId: spinVotes.userId });
    if (updated.length === 0) return { status: "not_voter" };

    const votes = await tx.select({ vote: spinVotes.vote }).from(spinVotes).where(eq(spinVotes.spinId, spin.id));
    const outcome = resolveVote({
      eligible: votes.length,
      yes: votes.filter((v) => v.vote === "yes").length,
      no: votes.filter((v) => v.vote === "no").length,
    });

    if (outcome === "pending") return { status: "voted", outcome };

    await tx
      .update(spins)
      .set({ status: outcome === "accepted" ? "accepted" : "rejected", resolvedAt: now })
      .where(eq(spins.id, spin.id));

    if (outcome === "accepted") {
      // The room watches it now: out of the pool, and ratable.
      await tx
        .insert(roomMovies)
        .values({ roomId: input.roomId, movieId: spin.movieId, status: "watched", spinId: spin.id })
        .onConflictDoNothing();
      return { status: "voted", outcome };
    }
    if (outcome === "rejected") return { status: "voted", outcome };

    const nextSpinId = await insertSpin(tx, {
      roomId: input.roomId,
      launchedBy: input.userId,
      voterIds: await voterIdsOf(tx, spin.id),
      now,
    });
    return { status: "voted", outcome, nextSpinId };
  });
}

/**
 * "Déjà vu": removes the film from the room's pool and spins again. Only a
 * voter of this spin may do it: members not here tonight don't decide.
 */
export async function markSeenAndRelaunch(
  db: Database,
  input: { spinId: string; roomId: string; userId: string; now?: Date },
): Promise<MarkSeenResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const spin = await lockVotingSpin(tx, input.spinId, input.roomId);
    if (!spin) return { status: "closed" };

    const voterIds = await voterIdsOf(tx, spin.id);
    if (!voterIds.includes(input.userId)) return { status: "not_voter" };

    await tx
      .insert(roomMovies)
      .values({ roomId: input.roomId, movieId: spin.movieId, status: "seen_before", spinId: spin.id })
      .onConflictDoNothing();
    await tx.update(spins).set({ status: "seen", resolvedAt: now }).where(eq(spins.id, spin.id));

    const spinId = await insertSpin(tx, { roomId: input.roomId, launchedBy: input.userId, voterIds, now });
    return { status: "relaunched", spinId };
  });
}

/** The room's latest spin with its film and voters, or null if none yet. */
export async function getLatestSpin(db: Database, roomId: string): Promise<CurrentSpin | null> {
  const [row] = await db
    .select({
      id: spins.id,
      status: spins.status,
      createdAt: spins.createdAt,
      launchedBy: profiles.pseudo,
      movie: {
        tmdbId: movies.tmdbId,
        title: movies.title,
        releaseYear: movies.releaseYear,
        runtimeMinutes: movies.runtimeMinutes,
        posterPath: movies.posterPath,
        overview: movies.overview,
        tmdbRating: movies.tmdbRating,
      },
    })
    .from(spins)
    .innerJoin(movies, eq(movies.tmdbId, spins.movieId))
    .leftJoin(profiles, eq(profiles.id, spins.launchedBy))
    .where(eq(spins.roomId, roomId))
    .orderBy(desc(spins.createdAt))
    .limit(1);
  if (!row) return null;

  const [providers, voters] = await Promise.all([
    db
      .select({ provider: movieProviders.provider })
      .from(movieProviders)
      .where(eq(movieProviders.movieId, row.movie.tmdbId))
      .orderBy(asc(movieProviders.provider)),
    db
      .select({ userId: spinVotes.userId, pseudo: profiles.pseudo, vote: spinVotes.vote })
      .from(spinVotes)
      .innerJoin(profiles, eq(profiles.id, spinVotes.userId))
      .where(eq(spinVotes.spinId, row.id))
      .orderBy(asc(profiles.pseudo)),
  ]);

  return {
    ...row,
    movie: { ...row.movie, providers: providers.map((p) => p.provider) },
    voters,
  };
}
