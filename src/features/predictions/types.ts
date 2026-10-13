import type { VoteValue } from "@/features/roulette/types";

export type Prediction = {
  id: string;
  content: string;
  createdAt: Date;
};

/** A prediction once the film is over, with the room's votes on it. */
export type JudgedPrediction = Prediction & {
  /** True = validated (1 point), false = missed, null = still being judged. */
  validated: boolean | null;
  yes: number;
  no: number;
  myVote: VoteValue | null;
};

export type PredictionAuthor = {
  userId: string;
  pseudo: string;
  points: number;
  predictions: JudgedPrediction[];
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
  /** When the votes on predictions close (null while the film is on). */
  judgingEndsAt: Date | null;
  /** The member can still vote on the others' predictions. */
  canJudge: boolean;
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

/** A finished film whose predictions wait for the member's votes. */
export type FilmToJudge = FilmInProgress;

export type PredictionVerdict = "pending" | "validated" | "rejected";

export type CastPredictionVoteResult =
  | { status: "voted"; verdict: PredictionVerdict }
  | { status: "not_found" | "not_finished" | "closed" | "own_prediction" | "not_voter" };

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
