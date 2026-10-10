import { z } from "zod";

const API_BASE = "https://api.themoviedb.org/3";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

const providersSchema = z.object({
  results: z.array(z.object({ provider_id: z.number(), provider_name: z.string() })),
});

const discoverSchema = z.object({
  page: z.number(),
  total_pages: z.number(),
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      overview: z.string().default(""),
      poster_path: z.string().nullable().default(null),
      release_date: z.string().default(""),
      vote_average: z.number(),
      vote_count: z.number(),
    }),
  ),
});

const movieDetailsSchema = z.object({
  id: z.number(),
  runtime: z.number().nullable().default(null),
});

export type TmdbMovieSummary = z.infer<typeof discoverSchema>["results"][number];
export type TmdbDiscoverPage = z.infer<typeof discoverSchema>;

export type DiscoverComediesQuery = {
  providerIds: number[];
  page: number;
  minVoteCount: number;
};

export type TmdbClient = {
  listMovieProviders(): Promise<z.infer<typeof providersSchema>["results"]>;
  discoverFrenchComedies(query: DiscoverComediesQuery): Promise<TmdbDiscoverPage>;
  getRuntime(movieId: number): Promise<number | null>;
};

export class TmdbError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Sleep = (ms: number) => Promise<void>;

const COMEDY_GENRE_ID = 35;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** "fetch failed" alone hides the real cause (ECONNRESET, ENOTFOUND, timeout…). */
function describeNetworkError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  const detail =
    cause && typeof cause === "object" && "code" in cause ? String(cause.code) : cause instanceof Error ? cause.message : "";
  return detail ? `${error.message} (${detail})` : error.message;
}

/** Retry-After is seconds or an HTTP date; anything unusable falls back to backoff. */
function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt;
}

export function createTmdbClient(options: {
  token: string;
  fetch?: FetchLike;
  sleep?: Sleep;
  timeoutMs?: number;
}): TmdbClient {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  async function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const url = `${API_BASE}${path}?${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await doFetch(url, {
          headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" },
          // A stuck connection must not eat the whole cron run.
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        // Network error or timeout.
        if (attempt < MAX_ATTEMPTS) {
          await sleep(retryDelayMs(null, attempt));
          continue;
        }
        throw new TmdbError(`TMDB ${path} unreachable: ${describeNetworkError(error)}`);
      }

      if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }
      if (!response.ok) {
        throw new TmdbError(`TMDB ${path} responded ${response.status}`, response.status);
      }

      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) {
        throw new TmdbError(`Unexpected TMDB response for ${path}: ${z.prettifyError(parsed.error)}`);
      }
      return parsed.data;
    }
  }

  return {
    async listMovieProviders() {
      const data = await get("/watch/providers/movie", { watch_region: "FR" }, providersSchema);
      return data.results;
    },

    discoverFrenchComedies({ providerIds, page, minVoteCount }) {
      return get(
        "/discover/movie",
        {
          language: "fr-FR",
          watch_region: "FR",
          with_watch_providers: providerIds.join("|"),
          // Included in the subscription, not rentals or purchases.
          with_watch_monetization_types: "flatrate",
          with_genres: String(COMEDY_GENRE_ID),
          with_original_language: "fr",
          with_origin_country: "FR",
          "vote_count.gte": String(minVoteCount),
          include_adult: "false",
          // Stable order: popularity shifts between page fetches, which
          // would skip films at page boundaries.
          sort_by: "original_title.asc",
          page: String(page),
        },
        discoverSchema,
      );
    },

    async getRuntime(movieId) {
      const data = await get(`/movie/${movieId}`, {}, movieDetailsSchema);
      return data.runtime && data.runtime > 0 ? data.runtime : null;
    },
  };
}
