import type { StreamingProvider } from "@/features/catalog/types";
import type { ScoreSummary, Scores } from "./scores";

export type WatchedMovie = {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterPath: string | null;
  providers: StreamingProvider[];
  watchedAt: Date;
  /** Null while the room is still watching it: predictions open, no rating yet. */
  finishedAt: Date | null;
  summary: ScoreSummary;
  ratedByMe: boolean;
};

export type MemberRating = {
  userId: string;
  pseudo: string;
  /** Null when this member has not rated the film. */
  scores: Scores | null;
};

export type MovieDetail = Omit<WatchedMovie, "ratedByMe"> & {
  overview: string;
  ratings: MemberRating[];
  myScores: Scores | null;
};

export type RoomStats = {
  watchedCount: number;
  /** Mean of the rated films' averages. */
  roomAverage: number | null;
  /** Mean of every acting bonus given in the room. */
  actingAverage: number | null;
  /** The worst rated film: the Navet d'Or. */
  navet: WatchedMovie | null;
};

export type RatingFormState = {
  error?: string;
};
