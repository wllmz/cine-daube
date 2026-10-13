/** Each member's predictions per film. */
export const MAX_PREDICTIONS = 10;

/** A "Film terminé ?" vote ignores members who have not voted after this delay. */
export const FINISH_VOTE_TTL_MS = 20 * 60 * 1000;

export function isFinishVoteExpired(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= FINISH_VOTE_TTL_MS;
}
