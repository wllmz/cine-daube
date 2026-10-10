import "server-only";
import { and, count, eq, exists, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { movieProviders, movies } from "@/db/schema";
import { resolveProviderIds } from "../providers";
import type { TmdbClient, TmdbMovieSummary } from "../tmdb-client";
import {
  STREAMING_PROVIDERS,
  SyncAlreadyRunningError,
  type IncompleteReason,
  type StreamingProvider,
  type SyncReport,
} from "../types";

export type SyncOptions = {
  now?: Date;
  /** Skips obscure films nobody can judge (and TMDB noise). */
  minVoteCount?: number;
  /** 20 results per page: 50 pages = 1000 films per platform. */
  maxPagesPerProvider?: number;
  /** Runtimes need one request per film: filled progressively, run after run. */
  maxRuntimeLookups?: number;
  /**
   * A platform returning less than this share of yesterday's films is
   * treated as a TMDB glitch: its existing links are kept.
   */
  minShareOfPrevious?: number;
};

const WRITE_CHUNK = 500;
// Arbitrary constant identifying the catalog sync lock.
const SYNC_LOCK_KEY = 4_242_001;
// Below this many links, a drop is not considered suspicious (tiny catalogs move a lot).
const MIN_LINKS_FOR_DROP_CHECK = 10;

function releaseYear(date: string): number | null {
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isInteger(year) && year > 1880 ? year : null;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Every page of French comedies for one platform, and whether it was cut short. */
async function fetchPlatform(
  client: TmdbClient,
  providerIds: number[],
  minVoteCount: number,
  maxPages: number,
): Promise<{ films: TmdbMovieSummary[]; truncated: boolean }> {
  const films: TmdbMovieSummary[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client.discoverFrenchComedies({ providerIds, page, minVoteCount });
    films.push(...result.results);
    if (page >= result.total_pages) return { films, truncated: false };
    if (page >= maxPages) return { films, truncated: true };
  }
}

/**
 * Mirrors TMDB's French comedies on the 4 platforms into `movies` and
 * `movie_providers`.
 *
 * Everything is fetched before anything is written, then applied in one
 * transaction. Stale links are only removed for platforms whose fetch is
 * complete and plausible: an empty, truncated or collapsing TMDB answer keeps
 * yesterday's links instead of emptying the roulette.
 */
export async function syncCatalog(
  db: Database,
  client: TmdbClient,
  options: SyncOptions = {},
): Promise<SyncReport> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const minVoteCount = options.minVoteCount ?? 20;
  const maxPages = options.maxPagesPerProvider ?? 50;
  const minShare = options.minShareOfPrevious ?? 0.5;

  const providerIds = resolveProviderIds(await client.listMovieProviders());

  const films = new Map<number, TmdbMovieSummary>();
  const linksByProvider = new Map<StreamingProvider, number[]>();
  const incompletePlatforms: SyncReport["incompletePlatforms"] = {};

  for (const provider of STREAMING_PROVIDERS) {
    const result = await fetchPlatform(client, providerIds[provider], minVoteCount, maxPages);
    const ids = new Set<number>();
    for (const film of result.films) {
      films.set(film.id, film);
      ids.add(film.id);
    }
    linksByProvider.set(provider, [...ids]);
    if (result.truncated) incompletePlatforms[provider] = "truncated";
  }

  const linksRemoved = await db.transaction(async (tx) => {
    // One writer at a time (duplicate cron delivery, manual run). Transaction
    // scoped, so it works through the Supabase transaction pooler.
    const [lock] = await tx
      .select({ locked: sql<boolean>`pg_try_advisory_xact_lock(${SYNC_LOCK_KEY})` })
      .from(sql`(values (1)) as single_row(x)`);
    if (!lock?.locked) throw new SyncAlreadyRunningError();

    const previous = await tx
      .select({ provider: movieProviders.provider, links: count() })
      .from(movieProviders)
      .groupBy(movieProviders.provider);
    for (const { provider, links } of previous) {
      const fetched = linksByProvider.get(provider)?.length ?? 0;
      if (links >= MIN_LINKS_FOR_DROP_CHECK && fetched < links * minShare && !incompletePlatforms[provider]) {
        incompletePlatforms[provider] = "suspicious_drop";
      }
    }

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

    const links = [...linksByProvider].flatMap(([provider, ids]) =>
      ids.map((movieId) => ({ movieId, provider, syncedAt: now })),
    );
    for (const batch of chunks(links, WRITE_CHUNK)) {
      await tx
        .insert(movieProviders)
        .values(batch)
        .onConflictDoUpdate({
          target: [movieProviders.movieId, movieProviders.provider],
          set: { syncedAt: sql`excluded.synced_at` },
        });
    }

    // Films that left a platform: links this run did not touch. Movies stay,
    // spins and ratings reference them.
    const complete = STREAMING_PROVIDERS.filter((provider) => !incompletePlatforms[provider]);
    if (complete.length === 0) return 0;
    const removed = await tx
      .delete(movieProviders)
      .where(and(inArray(movieProviders.provider, complete), ne(movieProviders.syncedAt, now)))
      .returning({ movieId: movieProviders.movieId });
    return removed.length;
  });

  const runtimes = await fillMissingRuntimes(db, client, options.maxRuntimeLookups ?? 60);

  const providerLinks = Object.fromEntries(
    STREAMING_PROVIDERS.map((provider) => [provider, linksByProvider.get(provider)?.length ?? 0]),
  ) as Record<StreamingProvider, number>;

  return {
    moviesUpserted: films.size,
    providerLinks,
    linksRemoved,
    incompletePlatforms: incompletePlatforms satisfies Partial<Record<StreamingProvider, IncompleteReason>>,
    runtimesFilled: runtimes.filled,
    runtimeErrors: runtimes.errors,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Looks up runtimes for available films that don't have one yet. Random
 * order, so films TMDB has no runtime for cannot block the others forever;
 * one failing film is skipped, not fatal (the catalog is already committed).
 */
async function fillMissingRuntimes(
  db: Database,
  client: TmdbClient,
  limit: number,
): Promise<{ filled: number; errors: number }> {
  if (limit <= 0) return { filled: 0, errors: 0 };
  const available = db
    .select({ one: sql`1` })
    .from(movieProviders)
    .where(eq(movieProviders.movieId, movies.tmdbId));
  const missing = await db
    .select({ tmdbId: movies.tmdbId })
    .from(movies)
    .where(and(isNull(movies.runtimeMinutes), exists(available)))
    .orderBy(sql`random()`)
    .limit(limit);

  let filled = 0;
  let errors = 0;
  for (const { tmdbId } of missing) {
    try {
      const runtime = await client.getRuntime(tmdbId);
      if (runtime === null) continue;
      await db
        .update(movies)
        .set({ runtimeMinutes: runtime })
        .where(and(eq(movies.tmdbId, tmdbId), isNull(movies.runtimeMinutes)));
      filled += 1;
    } catch (error) {
      errors += 1;
      console.warn(`Runtime lookup failed for TMDB movie ${tmdbId}`, error);
    }
  }
  return { filled, errors };
}
