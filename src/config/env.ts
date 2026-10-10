import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  /** Public URL of the app, used to build links sent by email. */
  SITE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/**
 * Validated server-side environment. Parsed lazily so that a missing
 * variable fails loudly at first use instead of at build time.
 */
export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid server environment variables:\n${z.prettifyError(result.error)}`,
      );
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}
