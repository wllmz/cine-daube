import type { StreamingProvider } from "@/features/catalog/types";

export type SpinStatus = "voting" | "accepted" | "rejected" | "seen";
export type VoteValue = "yes" | "no";

export type SpinMovie = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  overview: string;
  tmdbRating: number;
  providers: StreamingProvider[];
};

export type SpinVoter = {
  userId: string;
  pseudo: string;
  vote: VoteValue | null;
};

export type CurrentSpin = {
  id: string;
  status: SpinStatus;
  createdAt: Date;
  launchedBy: string | null;
  movie: SpinMovie;
  voters: SpinVoter[];
};

export type StartSpinResult =
  | { status: "started"; spinId: string }
  | { status: "already_voting"; spinId: string }
  | { status: "empty_pool" };

export type CastVoteResult =
  | { status: "voted"; outcome: "pending" | "accepted" | "rejected" }
  /** Tie: the roulette spun again (spinId is null when no film is left). */
  | { status: "voted"; outcome: "tie"; nextSpinId: string | null }
  | { status: "closed" | "not_voter" };

export type MarkSeenResult =
  | { status: "relaunched"; spinId: string | null }
  | { status: "closed" };

/** State returned by roulette server actions. */
export type RouletteActionState = { error?: string };
