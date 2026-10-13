export type LeaderboardEntry = {
  userId: string;
  pseudo: string;
  /** Validated predictions: 1 point each. */
  points: number;
  /** Predictions the room has judged (validated or missed). */
  judged: number;
  /** Shared on a tie: 1, 1, 3… */
  rank: number;
};
