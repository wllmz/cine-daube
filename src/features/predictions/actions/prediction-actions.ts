"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { movieIdSchema } from "@/features/ratings/schemas";
import { requireRoomMember } from "@/features/rooms/server";
import { MAX_PREDICTIONS } from "../rules";
import { predictionContentSchema, predictionIdSchema, proposalIdSchema, voteValueSchema } from "../schemas";
import { castPredictionVote } from "../services/judging-service";
import { addPrediction, castFinishVote, deletePrediction, proposeFinish } from "../services/prediction-service";
import type { PredictionActionState } from "../types";

const NOT_FOUND = "Film introuvable.";
const FINISHED = "Le film est terminé : les prédictions sont fermées.";
const NOT_PARTICIPANT = "Seuls ceux qui ont voté pour ce film à la roulette participent.";
const CLOSED = "Ce vote est déjà terminé.";

async function memberContext(roomId: string) {
  const [room, user] = await Promise.all([requireRoomMember(roomId), getCurrentUser()]);
  return { room, user };
}

export async function addPredictionAction(
  roomId: string,
  movieId: number,
  _state: PredictionActionState,
  formData: FormData,
): Promise<PredictionActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedMovie = movieIdSchema.safeParse(String(movieId));
  if (!parsedMovie.success) return { error: NOT_FOUND };
  const content = predictionContentSchema.safeParse(formData.get("content") ?? undefined);
  if (!content.success) return { error: content.error.issues[0]?.message };

  const result = await addPrediction(getDb(), {
    roomId: room.id,
    movieId: parsedMovie.data,
    userId: user.id,
    content: content.data,
  });
  refresh();
  switch (result.status) {
    case "added":
      return {};
    case "limit_reached":
      return { error: `${MAX_PREDICTIONS} prédictions maximum : supprime-en une pour en ajouter.` };
    case "finished":
      return { error: FINISHED };
    case "not_participant":
      return { error: NOT_PARTICIPANT };
    case "not_found":
      return { error: NOT_FOUND };
  }
}

export async function deletePredictionAction(
  roomId: string,
  movieId: number,
  predictionId: string,
): Promise<PredictionActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedMovie = movieIdSchema.safeParse(String(movieId));
  const parsedPrediction = predictionIdSchema.safeParse(predictionId);
  if (!parsedMovie.success || !parsedPrediction.success) return { error: NOT_FOUND };

  const result = await deletePrediction(getDb(), {
    roomId: room.id,
    movieId: parsedMovie.data,
    userId: user.id,
    predictionId: parsedPrediction.data,
  });
  refresh();
  if (result.status === "finished") return { error: FINISHED };
  return {};
}

export async function proposeFinishAction(roomId: string, movieId: number): Promise<PredictionActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedMovie = movieIdSchema.safeParse(String(movieId));
  if (!parsedMovie.success) return { error: NOT_FOUND };

  const result = await proposeFinish(getDb(), { roomId: room.id, movieId: parsedMovie.data, userId: user.id });
  refresh();
  if (result.status === "not_participant") return { error: NOT_PARTICIPANT };
  if (result.status === "not_found") return { error: NOT_FOUND };
  // Already voting or already finished: the refreshed page shows it.
  return {};
}

export async function castFinishVoteAction(
  roomId: string,
  proposalId: string,
  vote: string,
): Promise<PredictionActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedProposal = proposalIdSchema.safeParse(proposalId);
  const parsedVote = voteValueSchema.safeParse(vote);
  if (!parsedProposal.success || !parsedVote.success) return { error: "Vote invalide." };

  const result = await castFinishVote(getDb(), {
    roomId: room.id,
    proposalId: parsedProposal.data,
    userId: user.id,
    vote: parsedVote.data,
  });
  refresh();
  if (result.status === "closed") return { error: CLOSED };
  if (result.status === "not_voter") return { error: NOT_PARTICIPANT };
  return {};
}

const PREDICTION_VOTE_ERRORS = {
  not_found: "Prédiction introuvable.",
  not_finished: "Attends la fin du film pour juger les prédictions.",
  closed: "Les votes sur cette prédiction sont terminés.",
  own_prediction: "Tu ne peux pas juger tes propres prédictions.",
  not_voter: NOT_PARTICIPANT,
} as const;

export async function castPredictionVoteAction(
  roomId: string,
  predictionId: string,
  vote: string,
): Promise<PredictionActionState> {
  const { room, user } = await memberContext(roomId);
  const parsedPrediction = predictionIdSchema.safeParse(predictionId);
  const parsedVote = voteValueSchema.safeParse(vote);
  if (!parsedPrediction.success || !parsedVote.success) return { error: "Vote invalide." };

  const result = await castPredictionVote(getDb(), {
    roomId: room.id,
    predictionId: parsedPrediction.data,
    userId: user.id,
    vote: parsedVote.data,
  });
  refresh();
  return result.status === "voted" ? {} : { error: PREDICTION_VOTE_ERRORS[result.status] };
}
