import { z } from "zod";

const score = z.coerce.number().int().min(0, "Entre 0 et 10.").max(10, "Entre 0 et 10.");

/** Form fields: the acting bonus only counts when its checkbox is ticked. */
export const ratingFormSchema = z
  .object({
    humour: score,
    scenario: score,
    actingEnabled: z.literal("on").optional(),
    acting: score.optional(),
  })
  .transform(({ humour, scenario, actingEnabled, acting }) => ({
    humour,
    scenario,
    acting: actingEnabled === "on" ? (acting ?? null) : null,
  }));

export const movieIdSchema = z.coerce.number().int().positive();
