import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { movieProviders, movies } from "@/db/schema";
import { resolveProviderIds } from "../providers";
import type { TmdbClient, TmdbMovieSummary } from "../tmdb-client";
import { STREAMING_PROVIDERS, type StreamingProvider, type SyncReport } from "../types";

export type SyncOptions = {
  now?: Date;
  /** Skips obscure films nobody can judge (and TMDB noise). */
  minVoteCount?: number;
  /** 20 results per page: 25 pages = 500 films per platform at most. */
  maxPagesPerProvider?: number;
  /** Runtimes need one request per film: filled progressively, run after run. */
  maxRuntimeLookups?: number;
};

const WRITE_CHUNK = 500;

function releaseYear(date: string): number | null {
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isInteger(year) && year > 1880 ? year : null;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Every page of French comedies for one platform. */
async function fetchPlatform(
  client: TmdbClient,
  providerIds: number[],
  minVoteCount: number,
  maxPages: number,
): Promise<TmdbMovieSummary[]> {
  const films: TmdbMovieSummary[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await client.discoverFrenchComedies({ providerIds, page, minVoteCount });
    films.push(...result.results);
    if (page >= result.total_pages) break;
  }
  return films;
}

/**
 * Mirrors TMDB's French comedies on the 4 platforms into `movies` and
 * `movie_providers`. Everything is fetched before anything is written, then
 * applied in one transaction: a TMDB failure leaves yesterday's catalog
 * intact instead of emptying a platform.
 */
export async function syncCatalog(
  db: Database,
  client: TmdbClient,
  options: SyncOptions = {},
): Promise<SyncReport> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const minVoteCount = options.minVoteCount ?? 20;
  const maxPages = options.maxPagesPerProvider ?? 25;

  const providerIds = resolveProviderIds(await client.listMovieProviders());

  const films = new Map<number, TmdbMovieSummary>();
  const links: { movieId: number; provider: StreamingProvider }[] = [];
  const providerLinks = Object.fromEntries(STREAMING_PROVIDERS.map((p) => [p, 0])) as Record<
    StreamingProvider,
    number
  >;

  for (const provider of STREAMING_PROVIDERS) {
    const platformFilms = await fetchPlatform(client, providerIds[provider], minVoteCount, maxPages);
    const seen = new Set<number>();
    for (const film of platformFilms) {
      films.set(film.id, film);
      if (!seen.has(film.id)) {
        seen.add(film.id);
        links.push({ movieId: film.id, provider });
      }
    }
    providerLinks[provider] = seen.size;
  }

  const linksRemoved = await db.transaction(async (tx) => {
    for (const batch of chunks([...films.values()], WRITE_CHUNK)) {
      await tx
        .insert(movies)
        .values(
          batch.map((film) => ({
            tmdbId: film.id,
            title: film.title,
            releaseYear: releaseYear(film.release_date),
            posterPath: film.poster_path,
            overview: film.overview,
            tmdbRating: film.vote_average,
            tmdbVoteCount: film.vote_count,
            syncedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: movies.tmdbId,
          set: {
            title: sql`excluded.title`,
            releaseYear: sql`excluded.release_year`,
            posterPath: sql`excluded.poster_path`,
            overview: sql`excluded.overview`,
            tmdbRating: sql`excluded.tmdb_rating`,
            tmdbVoteCount: sql`excluded.tmdb_vote_count`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    for (const batch of chunks(links, WRITE_CHUNK)) {
      await tx
        .insert(movieProviders)
        .values(batch.map((link) => ({ ...link, syncedAt: now })))
        .onConflictDoUpdate({
          target: [movieProviders.movieId, movieProviders.provider],
          set: { syncedAt: sql`excluded.synced_at` },
        });
    }

    // Films that left a platform since the last run. Movies themselves stay:
    // spins and ratings reference them.
    const removed = await tx
      .delete(movieProviders)
      .where(lt(movieProviders.syncedAt, now))
      .returning({ movieId: movieProviders.movieId });
    return removed.length;
  });

  const runtimesFilled = await fillMissingRuntimes(db, client, options.maxRuntimeLookups ?? 60);

  return {
    moviesUpserted: films.size,
    providerLinks,
    linksRemoved,
    runtimesFilled,
    durationMs: Date.now() - startedAt,
  };
}

/** Looks up runtimes for available films that don't have one yet. */
async function fillMissingRuntimes(db: Database, client: TmdbClient, limit: number): Promise<number> {
  if (limit <= 0) return 0;
  const missing = await db
    .selectDistinct({ tmdbId: movies.tmdbId })
    .from(movies)
    .innerJoin(movieProviders, eq(movieProviders.movieId, movies.tmdbId))
    .where(isNull(movies.runtimeMinutes))
    .limit(limit);

  let filled = 0;
  for (const { tmdbId } of missing) {
    const runtime = await client.getRuntime(tmdbId);
    if (runtime === null) continue;
    await db
      .update(movies)
      .set({ runtimeMinutes: runtime })
      .where(and(eq(movies.tmdbId, tmdbId), isNull(movies.runtimeMinutes)));
    filled += 1;
  }
  return filled;
}
