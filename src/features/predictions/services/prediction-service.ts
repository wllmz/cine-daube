import "server-only";
import { and, asc, count, desc, eq, gt, isNull, lte, ne } from "drizzle-orm";
import type { Database } from "@/db";
import { finishProposals, finishVotes, movies, predictions, profiles, roomMovies, spinVotes } from "@/db/schema";
import { resolveVote } from "@/features/roulette/vote";
import { FINISH_VOTE_TTL_MS, MAX_PREDICTIONS, isFinishVoteExpired } from "../rules";
import type {
  AddPredictionResult,
  CastFinishVoteResult,
  DeletePredictionResult,
  FilmInProgress,
  FinishOutcome,
  FinishVote,
  PendingFinishVote,
  Prediction,
  PredictionAuthor,
  PredictionBoard,
  ProposeFinishResult,
} from "../types";

type FilmKey = { roomId: string; movieId: number };

/**
 * Locks the room's watched film. Every write about a film's predictions or
 * its end goes through this lock first, so they apply one at a time and in
 * the same order (no deadlock, no 11th prediction, no prediction after the end).
 */
async function lockFilm(db: Database, { roomId, movieId }: FilmKey) {
  const [film] = await db
    .select({ spinId: roomMovies.spinId, finishedAt: roomMovies.finishedAt })
    .from(roomMovies)
    .where(and(eq(roomMovies.roomId, roomId), eq(roomMovies.movieId, movieId), eq(roomMovies.status, "watched")))
    // finished_at is not a key column: ratings' foreign key checks are not blocked.
    .for("no key update");
  return film ?? null;
}

/** Members who voted the film in at the roulette (and are still in the room). */
async function participantIds(db: Database, spinId: string | null): Promise<string[]> {
  if (!spinId) return [];
  const rows = await db.select({ userId: spinVotes.userId }).from(spinVotes).where(eq(spinVotes.spinId, spinId));
  return rows.map((row) => row.userId);
}

/** Adds a prediction while the film is on, up to the limit per member. */
export async function addPrediction(
  db: Database,
  input: FilmKey & { userId: string; content: string },
): Promise<AddPredictionResult> {
  return db.transaction(async (tx) => {
    const film = await lockFilm(tx, input);
    if (!film) return { status: "not_found" };
    if (film.finishedAt) return { status: "finished" };
    if (!(await participantIds(tx, film.spinId)).includes(input.userId)) return { status: "not_participant" };

    const [mine] = await tx
      .select({ total: count() })
      .from(predictions)
      .where(
        and(eq(predictions.roomId, input.roomId), eq(predictions.movieId, input.movieId), eq(predictions.userId, input.userId)),
      );
    if ((mine?.total ?? 0) >= MAX_PREDICTIONS) return { status: "limit_reached" };

    await tx
      .insert(predictions)
      .values({ roomId: input.roomId, movieId: input.movieId, userId: input.userId, content: input.content });
    return { status: "added" };
  });
}

/** Removes one of the member's own predictions, until the film is finished. */
export async function deletePrediction(
  db: Database,
  input: FilmKey & { userId: string; predictionId: string },
): Promise<DeletePredictionResult> {
  return db.transaction(async (tx) => {
    const film = await lockFilm(tx, input);
    if (!film) return { status: "not_found" };
    if (film.finishedAt) return { status: "finished" };

    const deleted = await tx
      .delete(predictions)
      .where(
        and(
          eq(predictions.id, input.predictionId),
          eq(predictions.roomId, input.roomId),
          eq(predictions.movieId, input.movieId),
          eq(predictions.userId, input.userId),
        ),
      )
      .returning({ id: predictions.id });
    return { status: deleted.length > 0 ? "deleted" : "not_found" };
  });
}

/**
 * Resolves a "Film terminé ?" vote when it can be: majority of the voters,
 * or once expired, majority of the votes cast. A tie, a majority of "no" or
 * an expired vote nobody answered closes it and the film goes on.
 */
async function settleProposal(
  db: Database,
  input: FilmKey & { proposalId: string; expired: boolean; now: Date },
): Promise<FinishOutcome> {
  const votes = await db.select({ vote: finishVotes.vote }).from(finishVotes).where(eq(finishVotes.proposalId, input.proposalId));
  const yes = votes.filter((v) => v.vote === "yes").length;
  const no = votes.filter((v) => v.vote === "no").length;
  const result = resolveVote({ eligible: input.expired ? yes + no : votes.length, yes, no });
  if (result === "pending" && !input.expired) return "pending";

  const outcome = result === "accepted" ? "accepted" : "rejected";
  await db
    .update(finishProposals)
    .set({ status: outcome, resolvedAt: input.now })
    .where(eq(finishProposals.id, input.proposalId));
  if (outcome === "accepted") {
    await db
      .update(roomMovies)
      .set({ finishedAt: input.now })
      .where(and(eq(roomMovies.roomId, input.roomId), eq(roomMovies.movieId, input.movieId)));
  }
  return outcome;
}

async function votingProposal(db: Database, { roomId, movieId }: FilmKey) {
  const [proposal] = await db
    .select({ id: finishProposals.id, createdAt: finishProposals.createdAt })
    .from(finishProposals)
    .where(
      and(eq(finishProposals.roomId, roomId), eq(finishProposals.movieId, movieId), eq(finishProposals.status, "voting")),
    )
    .limit(1);
  return proposal ?? null;
}

/**
 * "Film terminé ?": opens a vote for the film's participants, the proposer
 * voting yes. An expired vote still open is settled first.
 */
export async function proposeFinish(
  db: Database,
  input: FilmKey & { userId: string; now?: Date },
): Promise<ProposeFinishResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const film = await lockFilm(tx, input);
    if (!film) return { status: "not_found" };
    if (film.finishedAt) return { status: "finished" };
    const voterIds = await participantIds(tx, film.spinId);
    if (!voterIds.includes(input.userId)) return { status: "not_participant" };

    const open = await votingProposal(tx, input);
    if (open) {
      if (!isFinishVoteExpired(open.createdAt, now)) return { status: "already_voting", proposalId: open.id };
      const outcome = await settleProposal(tx, { ...input, proposalId: open.id, expired: true, now });
      if (outcome === "accepted") return { status: "finished" };
    }

    const [proposal] = await tx
      .insert(finishProposals)
      .values({ roomId: input.roomId, movieId: input.movieId, proposedBy: input.userId, createdAt: now })
      .returning({ id: finishProposals.id });
    if (!proposal) throw new Error("Finish proposal insert returned no row");

    await tx.insert(finishVotes).values(
      voterIds.map((userId) =>
        userId === input.userId
          ? { proposalId: proposal.id, roomId: input.roomId, userId, vote: "yes" as const, votedAt: now }
          : { proposalId: proposal.id, roomId: input.roomId, userId },
      ),
    );
    const outcome = await settleProposal(tx, { ...input, proposalId: proposal.id, expired: false, now });
    return { status: "proposed", proposalId: proposal.id, outcome };
  });
}

/**
 * Settles the room's "Film terminé ?" votes past their delay with the votes
 * cast, so a film ends on time even if nobody clicks again. Called before
 * reading, safe to run concurrently (each vote is re-checked under the lock).
 */
export async function settleExpiredFinishVotes(db: Database, input: { roomId: string; now: Date }): Promise<void> {
  const expired = await db
    .select({ id: finishProposals.id, movieId: finishProposals.movieId })
    .from(finishProposals)
    .where(
      and(
        eq(finishProposals.roomId, input.roomId),
        eq(finishProposals.status, "voting"),
        lte(finishProposals.createdAt, new Date(input.now.getTime() - FINISH_VOTE_TTL_MS)),
      ),
    );
  for (const proposal of expired) {
    await db.transaction(async (tx) => {
      await lockFilm(tx, { roomId: input.roomId, movieId: proposal.movieId });
      const [current] = await tx
        .select({ status: finishProposals.status })
        .from(finishProposals)
        .where(eq(finishProposals.id, proposal.id));
      if (current?.status !== "voting") return;
      await settleProposal(tx, {
        roomId: input.roomId,
        movieId: proposal.movieId,
        proposalId: proposal.id,
        expired: true,
        now: input.now,
      });
    });
  }
}

/**
 * A new film was accepted at the roulette: the films still on are over,
 * so their predictions are revealed instead of staying hidden forever.
 */
export async function finishFilmsInProgress(
  db: Database,
  input: { roomId: string; exceptMovieId: number; now: Date },
): Promise<void> {
  const finished = await db
    .update(roomMovies)
    .set({ finishedAt: input.now })
    .where(
      and(
        eq(roomMovies.roomId, input.roomId),
        eq(roomMovies.status, "watched"),
        isNull(roomMovies.finishedAt),
        ne(roomMovies.movieId, input.exceptMovieId),
      ),
    )
    .returning({ movieId: roomMovies.movieId });
  for (const { movieId } of finished) {
    await db
      .update(finishProposals)
      .set({ status: "accepted", resolvedAt: input.now })
      .where(
        and(
          eq(finishProposals.roomId, input.roomId),
          eq(finishProposals.movieId, movieId),
          eq(finishProposals.status, "voting"),
        ),
      );
  }
}

/** Records a voter's answer (it can change until the vote is settled). */
export async function castFinishVote(
  db: Database,
  input: { roomId: string; proposalId: string; userId: string; vote: "yes" | "no"; now?: Date },
): Promise<CastFinishVoteResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ movieId: finishProposals.movieId })
      .from(finishProposals)
      .where(and(eq(finishProposals.id, input.proposalId), eq(finishProposals.roomId, input.roomId)));
    if (!target) return { status: "closed" };

    // Film first, then the proposal: same lock order as proposeFinish.
    await lockFilm(tx, { roomId: input.roomId, movieId: target.movieId });
    const [proposal] = await tx
      .select({ status: finishProposals.status, createdAt: finishProposals.createdAt })
      .from(finishProposals)
      .where(eq(finishProposals.id, input.proposalId));
    if (proposal?.status !== "voting") return { status: "closed" };

    const updated = await tx
      .update(finishVotes)
      .set({ vote: input.vote, votedAt: now })
      .where(and(eq(finishVotes.proposalId, input.proposalId), eq(finishVotes.userId, input.userId)))
      .returning({ userId: finishVotes.userId });
    if (updated.length === 0) return { status: "not_voter" };

    const outcome = await settleProposal(tx, {
      roomId: input.roomId,
      movieId: target.movieId,
      proposalId: input.proposalId,
      expired: isFinishVoteExpired(proposal.createdAt, now),
      now,
    });
    return { status: "voted", outcome };
  });
}

function groupByAuthor(
  rows: { userId: string; pseudo: string; id: string; content: string; createdAt: Date }[],
): PredictionAuthor[] {
  const authors = new Map<string, PredictionAuthor>();
  for (const { userId, pseudo, ...prediction } of rows) {
    const author = authors.get(userId) ?? { userId, pseudo, predictions: [] };
    author.predictions.push(prediction);
    authors.set(userId, author);
  }
  return [...authors.values()];
}

async function currentFinishVote(db: Database, input: FilmKey): Promise<FinishVote | null> {
  const [proposal] = await db
    .select({ id: finishProposals.id, createdAt: finishProposals.createdAt, proposedBy: profiles.pseudo })
    .from(finishProposals)
    .leftJoin(profiles, eq(profiles.id, finishProposals.proposedBy))
    .where(
      and(
        eq(finishProposals.roomId, input.roomId),
        eq(finishProposals.movieId, input.movieId),
        eq(finishProposals.status, "voting"),
      ),
    )
    .limit(1);
  if (!proposal) return null;

  const voters = await db
    .select({ userId: finishVotes.userId, pseudo: profiles.pseudo, vote: finishVotes.vote })
    .from(finishVotes)
    .innerJoin(profiles, eq(profiles.id, finishVotes.userId))
    .where(eq(finishVotes.proposalId, proposal.id))
    .orderBy(asc(profiles.pseudo));
  return {
    proposalId: proposal.id,
    proposedBy: proposal.proposedBy,
    createdAt: proposal.createdAt,
    voters,
  };
}

/**
 * The film's predictions as the given member may see them: their own, how
 * many each participant made, and everyone's once the film is finished.
 */
export async function getPredictionBoard(
  db: Database,
  input: FilmKey & { userId: string },
): Promise<PredictionBoard | null> {
  const [film] = await db
    .select({
      tmdbId: movies.tmdbId,
      title: movies.title,
      posterPath: movies.posterPath,
      spinId: roomMovies.spinId,
      finishedAt: roomMovies.finishedAt,
    })
    .from(roomMovies)
    .innerJoin(movies, eq(movies.tmdbId, roomMovies.movieId))
    .where(
      and(eq(roomMovies.roomId, input.roomId), eq(roomMovies.movieId, input.movieId), eq(roomMovies.status, "watched")),
    )
    .limit(1);
  if (!film) return null;

  const own = and(eq(predictions.roomId, input.roomId), eq(predictions.movieId, input.movieId));
  const [participants, counts, rows, finishVote] = await Promise.all([
    film.spinId
      ? db
          .select({ userId: spinVotes.userId, pseudo: profiles.pseudo })
          .from(spinVotes)
          .innerJoin(profiles, eq(profiles.id, spinVotes.userId))
          .where(eq(spinVotes.spinId, film.spinId))
          .orderBy(asc(profiles.pseudo))
      : Promise.resolve([]),
    db
      .select({ userId: predictions.userId, total: count() })
      .from(predictions)
      .where(own)
      .groupBy(predictions.userId),
    // Hidden until the end: while the film is on, only the member's own text is read.
    db
      .select({
        id: predictions.id,
        userId: predictions.userId,
        pseudo: profiles.pseudo,
        content: predictions.content,
        createdAt: predictions.createdAt,
      })
      .from(predictions)
      .innerJoin(profiles, eq(profiles.id, predictions.userId))
      .where(film.finishedAt ? own : and(own, eq(predictions.userId, input.userId)))
      .orderBy(asc(profiles.pseudo), asc(predictions.createdAt)),
    film.finishedAt ? Promise.resolve(null) : currentFinishVote(db, input),
  ]);

  const toPrediction = ({ id, content, createdAt }: (typeof rows)[number]): Prediction => ({ id, content, createdAt });
  return {
    movie: { tmdbId: film.tmdbId, title: film.title, posterPath: film.posterPath },
    finishedAt: film.finishedAt,
    isParticipant: participants.some((p) => p.userId === input.userId),
    participants: participants.map((p) => ({
      ...p,
      predictionCount: counts.find((c) => c.userId === p.userId)?.total ?? 0,
    })),
    myPredictions: rows.filter((row) => row.userId === input.userId).map(toPrediction),
    revealed: film.finishedAt ? groupByAuthor(rows) : [],
    finishVote,
  };
}

/** "Film terminé ?" votes still open in the room that wait for this member's answer. */
export async function listPendingFinishVotes(
  db: Database,
  input: { roomId: string; userId: string; now: Date },
): Promise<PendingFinishVote[]> {
  return db
    .select({
      proposalId: finishProposals.id,
      movieId: finishProposals.movieId,
      title: movies.title,
      proposedBy: profiles.pseudo,
    })
    .from(finishVotes)
    .innerJoin(finishProposals, eq(finishProposals.id, finishVotes.proposalId))
    .innerJoin(movies, eq(movies.tmdbId, finishProposals.movieId))
    .leftJoin(profiles, eq(profiles.id, finishProposals.proposedBy))
    .where(
      and(
        eq(finishVotes.roomId, input.roomId),
        eq(finishVotes.userId, input.userId),
        isNull(finishVotes.vote),
        eq(finishProposals.status, "voting"),
        gt(finishProposals.createdAt, new Date(input.now.getTime() - FINISH_VOTE_TTL_MS)),
      ),
    )
    .orderBy(asc(finishProposals.createdAt));
}

/** The latest film the room is still watching, if any. */
export async function findFilmInProgress(db: Database, roomId: string): Promise<FilmInProgress | null> {
  const [film] = await db
    .select({ tmdbId: movies.tmdbId, title: movies.title, posterPath: movies.posterPath })
    .from(roomMovies)
    .innerJoin(movies, eq(movies.tmdbId, roomMovies.movieId))
    .where(and(eq(roomMovies.roomId, roomId), eq(roomMovies.status, "watched"), isNull(roomMovies.finishedAt)))
    .orderBy(desc(roomMovies.createdAt))
    .limit(1);
  return film ?? null;
}
