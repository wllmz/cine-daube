import "server-only";
import { z } from "zod";

const catalogEnvSchema = z.object({
  /** TMDB "API Read Access Token" (v4 bearer token). */
  TMDB_API_TOKEN: z.string().min(20),
  /** Sent by Vercel Cron as `Authorization: Bearer <CRON_SECRET>`. */
  CRON_SECRET: z.string().min(16),
});

export type CatalogEnv = z.infer<typeof catalogEnvSchema>;

/**
 * Only the catalog sync needs these, so they are validated separately: a
 * missing TMDB token must not take the rest of the app down.
 */
export function getCatalogEnv(): CatalogEnv {
  const result = catalogEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid catalog environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
