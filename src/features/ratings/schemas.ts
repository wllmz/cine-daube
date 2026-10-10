import { z } from "zod";

// Digits only before converting: z.coerce alone turns "" into 0 (a real
// score here) and accepts "1e3" or " 42".
const digits = (message: string) => z.string().trim().regex(/^\d+$/, message);

const score = digits("Entre 0 et 10.")
  .transform(Number)
  .pipe(z.number().int().min(0, "Entre 0 et 10.").max(10, "Entre 0 et 10."));

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

/** TMDB ids in URLs: canonical positive integers only. */
export const movieIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.number().int().positive());
