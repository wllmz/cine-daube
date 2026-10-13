/** Each member's predictions per film. */
export const MAX_PREDICTIONS = 10;

/** A "Film terminé ?" vote ignores members who have not voted after this delay. */
export const FINISH_VOTE_TTL_MS = 20 * 60 * 1000;

export function isFinishVoteExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= FINISH_VOTE_TTL_MS;
}

/** Once the film is finished, its predictions are judged during this delay; then missing votes are ignored. */
export const JUDGING_TTL_MS = 20 * 60 * 1000;

export function judgingEndsAt(finishedAt: Date): Date {
  return new Date(finishedAt.getTime() + JUDGING_TTL_MS);
}

export function isJudgingOver(finishedAt: Date, now: Date): boolean {
  return now.getTime() >= judgingEndsAt(finishedAt).getTime();
}
