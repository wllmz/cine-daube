import { z } from "zod";

const API_BASE = "https://api.themoviedb.org/3";
const MAX_ATTEMPTS = 3;

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

export function createTmdbClient(options: {
  token: string;
  fetch?: FetchLike;
  sleep?: Sleep;
}): TmdbClient {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    const url = `${API_BASE}${path}?${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt += 1) {
      const response = await doFetch(url, {
        headers: { Authorization: `Bearer ${options.token}`, Accept: "application/json" },
      });

      // Rate limited: wait as asked, then retry a couple of times.
      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * attempt);
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
      const data = await get(
        "/watch/providers/movie",
        { watch_region: "FR", language: "fr-FR" },
        providersSchema,
      );
      return data.results;
    },

    discoverFrenchComedies({ providerIds, page, minVoteCount }) {
      return get(
        "/discover/movie",
        {
          language: "fr-FR",
          region: "FR",
          watch_region: "FR",
          with_watch_providers: providerIds.join("|"),
          // Included in the subscription, not rentals or purchases.
          with_watch_monetization_types: "flatrate",
          with_genres: String(COMEDY_GENRE_ID),
          with_original_language: "fr",
          with_origin_country: "FR",
          "vote_count.gte": String(minVoteCount),
          include_adult: "false",
          sort_by: "popularity.desc",
          page: String(page),
        },
        discoverSchema,
      );
    },

    async getRuntime(movieId) {
      const data = await get(`/movie/${movieId}`, { language: "fr-FR" }, movieDetailsSchema);
      return data.runtime && data.runtime > 0 ? data.runtime : null;
    },
  };
}
