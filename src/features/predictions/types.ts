import type { VoteValue } from "@/features/roulette/types";

export type Prediction = {
  id: string;
  content: string;
  createdAt: Date;
};

export type PredictionAuthor = {
  userId: string;
  pseudo: string;
  predictions: Prediction[];
};

export type FinishVoter = {
  userId: string;
  pseudo: string;
  vote: VoteValue | null;
};

/** The "Film terminé ?" vote in progress on a film. */
export type FinishVote = {
  proposalId: string;
  proposedBy: string | null;
  createdAt: Date;
  /** Past the delay: the next proposal settles it with the votes cast. */
  expired: boolean;
  voters: FinishVoter[];
};

export type PredictionBoard = {
  movie: { tmdbId: number; title: string; posterPath: string | null };
  finishedAt: Date | null;
  /** Roulette voters of this film: they predict and decide when it is over. */
  isParticipant: boolean;
  participants: { userId: string; pseudo: string; predictionCount: number }[];
  myPredictions: Prediction[];
  /** Everyone's predictions, only once the film is finished. */
  revealed: PredictionAuthor[];
  finishVote: FinishVote | null;
};

/** A vote waiting for the current user, for the room-wide banner. */
export type PendingFinishVote = {
  proposalId: string;
  movieId: number;
  title: string;
  proposedBy: string | null;
};

export type FilmInProgress = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
};

export type FinishOutcome = "pending" | "accepted" | "rejected";

export type AddPredictionResult = { status: "added" | "not_found" | "finished" | "not_participant" | "limit_reached" };
export type DeletePredictionResult = { status: "deleted" | "not_found" | "finished" };
export type ProposeFinishResult =
  | { status: "proposed"; proposalId: string; outcome: FinishOutcome }
  | { status: "already_voting"; proposalId: string }
  | { status: "not_found" | "finished" | "not_participant" };
export type CastFinishVoteResult =
  | { status: "voted"; outcome: FinishOutcome }
  | { status: "closed" | "not_voter" };

export type PredictionActionState = { error?: string };
