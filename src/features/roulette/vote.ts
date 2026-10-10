export type VoteTally = {
  /** Members chosen as voters when the roulette was launched. */
  eligible: number;
  yes: number;
  no: number;
};

export type VoteOutcome = "pending" | "accepted" | "rejected" | "tie";

/**
 * Majority of the eligible voters decides as soon as it is reached; if
 * everyone voted and it is a tie, the roulette spins again.
 */
export function resolveVote({ eligible, yes, no }: VoteTally): VoteOutcome {
  if (eligible <= 0) return "pending";
  if (yes * 2 > eligible) return "accepted";
  if (no * 2 > eligible) return "rejected";
  if (yes + no >= eligible) return "tie";
  return "pending";
}
