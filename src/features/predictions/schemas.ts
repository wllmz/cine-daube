import { z } from "zod";

export const predictionContentSchema = z
  .string()
  .trim()
  .min(1, "Écris ta prédiction.")
  .max(140, "140 caractères maximum.");

export const predictionIdSchema = z.uuid();
export const proposalIdSchema = z.uuid();
export const finishVoteSchema = z.enum(["yes", "no"]);
