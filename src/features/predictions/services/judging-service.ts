import "server-only";
import { and, desc, eq, exists, gt, inArray, isNull, lte, ne, notExists, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { movies, predictionVotes, predictions, roomMovies, spinVotes } from "@/db/schema";
import { resolveVote } from "@/features/roulette/vote";
import { JUDGING_TTL_MS, isJudgingOver } from "../rules";
import type { CastPredictionVoteResult, FilmToJudge } from "../types";

/**
 * The room's verdict on a prediction: majority of the voters (the film's
 * participants except the author), or once judging is over, majority of the
 * votes cast. A tie, or no vote at all, means no point.
 */
export function verdictOf(input: { eligible: number; yes: number; no: number; over: boolean }): boolean | null {
  const { yes, no, over } = input;
  const result = resolveVote({ eligible: over ? yes + no : input.eligible, yes, no });
  if (result === "accepted") return true;
  if (result === "pending") return over ? false : null;
  return false;
}

/**
 * Votes yes or no on someone else's prediction once the film is finished.
 * The vote can change until the prediction is judged.
 */
export async function castPredictionVote(
  db: Database,
  input: { roomId: string; predictionId: string; userId: string; vote: "yes" | "no"; now?: Date },
): Promise<CastPredictionVoteResult> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    // Locks the prediction: its votes are counted and judged one at a time.
    const [prediction] = await tx
      .select({
        authorId: predictions.userId,
        validated: predictions.validated,
        finishedAt: roomMovies.finishedAt,
        spinId: roomMovies.spinId,
      })
      .from(predictions)
      .innerJoin(
        roomMovies,
        and(eq(roomMovies.roomId, predictions.roomId), eq(roomMovies.movieId, predictions.movieId)),
      )
      .where(and(eq(predictions.id, input.predictionId), eq(predictions.roomId, input.roomId)))
      .for("no key update", { of: predictions });
    if (!prediction) return { status: "not_found" };
    if (!prediction.finishedAt) return { status: "not_finished" };
    if (prediction.validated !== null) return { status: "closed" };
    if (prediction.authorId === input.userId) return { status: "own_prediction" };

    const participants = prediction.spinId
      ? (await tx.select({ userId: spinVotes.userId }).from(spinVotes).where(eq(spinVotes.spinId, prediction.spinId))).map(
          (row) => row.userId,
        )
      : [];
    if (!participants.includes(input.userId)) return { status: "not_voter" };

    const over = isJudgingOver(prediction.finishedAt, now);
    if (!over) {
      await tx
        .insert(predictionVotes)
        .values({ predictionId: input.predictionId, roomId: input.roomId, userId: input.userId, vote: input.vote, votedAt: now })
        .onConflictDoUpdate({
          target: [predictionVotes.predictionId, predictionVotes.userId],
          set: { vote: input.vote, votedAt: now },
        });
    }

    const votes = await tx
      .select({ vote: predictionVotes.vote })
      .from(predictionVotes)
      .where(eq(predictionVotes.predictionId, input.predictionId));
    // A participant who left the room no longer counts (their votes leave with them).
    const validated = verdictOf({
      eligible: participants.filter((id) => id !== prediction.authorId).length,
      yes: votes.filter((v) => v.vote === "yes").length,
      no: votes.filter((v) => v.vote === "no").length,
      over,
    });
    if (validated !== null) {
      await tx.update(predictions).set({ validated, judgedAt: now }).where(eq(predictions.id, input.predictionId));
    }
    // Too late: the votes cast before the end decided it, this one does not count.
    if (over) return { status: "closed" };
    return { status: "voted", verdict: validated === null ? "pending" : validated ? "validated" : "rejected" };
  });
}

/**
 * Judges the room's predictions whose voting time is over, with the votes
 * cast (majority of yes; tie or no vote = no point). Called before reading.
 * Locks them first, then counts in a new statement: a vote committed while
 * waiting for the lock is counted (one statement would use an older snapshot).
 */
export async function settleExpiredPredictions(db: Database, input: { roomId: string; now: Date }): Promise<void> {
  const cutoff = new Date(input.now.getTime() - JUDGING_TTL_MS);
  const filmOver = db
    .select({ one: sql`1` })
    .from(roomMovies)
    .where(
      and(
        eq(roomMovies.roomId, predictions.roomId),
        eq(roomMovies.movieId, predictions.movieId),
        lte(roomMovies.finishedAt, cutoff),
      ),
    );
  const castFor = (onlyYes: boolean) =>
    sql`(select count(*) from ${predictionVotes} where ${predictionVotes.predictionId} = ${predictions.id}${
      onlyYes ? sql` and ${predictionVotes.vote} = 'yes'` : sql``
    })`;

  await db.transaction(async (tx) => {
    const due = await tx
      .select({ id: predictions.id })
      .from(predictions)
      .where(and(eq(predictions.roomId, input.roomId), isNull(predictions.validated), exists(filmOver)))
      .for("no key update", { of: predictions });
    if (due.length === 0) return;
    await tx
      .update(predictions)
      .set({ validated: sql`${castFor(true)} * 2 > ${castFor(false)}`, judgedAt: input.now })
      .where(
        and(
          inArray(
            predictions.id,
            due.map((row) => row.id),
          ),
          isNull(predictions.validated),
        ),
      );
  });
}

/** The latest finished film whose predictions still wait for this member's votes. */
export async function findFilmToJudge(
  db: Database,
  input: { roomId: string; userId: string; now: Date },
): Promise<FilmToJudge | null> {
  const cutoff = new Date(input.now.getTime() - JUDGING_TTL_MS);
  const myVote = db
    .select({ one: sql`1` })
    .from(predictionVotes)
    .where(and(eq(predictionVotes.predictionId, predictions.id), eq(predictionVotes.userId, input.userId)));
  const waitingForMe = db
    .select({ one: sql`1` })
    .from(predictions)
    .where(
      and(
        eq(predictions.roomId, roomMovies.roomId),
        eq(predictions.movieId, roomMovies.movieId),
        ne(predictions.userId, input.userId),
        isNull(predictions.validated),
        notExists(myVote),
      ),
    );
  const [film] = await db
    .select({ tmdbId: movies.tmdbId, title: movies.title, posterPath: movies.posterPath })
    .from(roomMovies)
    .innerJoin(movies, eq(movies.tmdbId, roomMovies.movieId))
    // Only the film's participants judge it.
    .innerJoin(spinVotes, and(eq(spinVotes.spinId, roomMovies.spinId), eq(spinVotes.userId, input.userId)))
    .where(
      and(
        eq(roomMovies.roomId, input.roomId),
        eq(roomMovies.status, "watched"),
        gt(roomMovies.finishedAt, cutoff),
        exists(waitingForMe),
      ),
    )
    .orderBy(desc(roomMovies.finishedAt))
    .limit(1);
  return film ?? null;
}
