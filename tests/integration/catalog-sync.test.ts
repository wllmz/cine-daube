// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { syncCatalog } from "@/features/catalog/services/sync-catalog";
import type { DiscoverComediesQuery, TmdbClient, TmdbMovieSummary } from "@/features/catalog/tmdb-client";
import { createTestDatabase } from "../helpers/test-database";

const PROVIDERS = [
  { provider_id: 8, provider_name: "Netflix" },
  { provider_id: 119, provider_name: "Amazon Prime Video" },
  { provider_id: 337, provider_name: "Disney Plus" },
  { provider_id: 381, provider_name: "Canal+" },
];

function film(id: number, title: string, overrides: Partial<TmdbMovieSummary> = {}): TmdbMovieSummary {
  return {
    id,
    title,
    overview: `Résumé de ${title}`,
    poster_path: `/${id}.jpg`,
    release_date: "2021-05-12",
    vote_average: 3.1,
    vote_count: 120,
    ...overrides,
  };
}

/** Fake TMDB: films per provider id, 2 per page, optional failure. */
function fakeTmdb(catalog: Record<number, TmdbMovieSummary[]>, options: { failOnProvider?: number } = {}) {
  const calls: DiscoverComediesQuery[] = [];
  const client: TmdbClient = {
    listMovieProviders: async () => PROVIDERS,
    discoverFrenchComedies: async (query) => {
      calls.push(query);
      if (options.failOnProvider !== undefined && query.providerIds.includes(options.failOnProvider)) {
        throw new Error("TMDB is down");
      }
      const all = query.providerIds.flatMap((id) => catalog[id] ?? []);
      const totalPages = Math.max(1, Math.ceil(all.length / 2));
      return { page: query.page, total_pages: totalPages, results: all.slice((query.page - 1) * 2, query.page * 2) };
    },
    getRuntime: async (id) => 90 + id,
  };
  return { client, calls };
}

let db: Database;
let pglite: PGlite;

async function rows(query: string) {
  return (await pglite.query<Record<string, unknown>>(query)).rows;
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
});

describe("syncCatalog", () => {
  it("stores films with every platform they are on", async () => {
    const { client } = fakeTmdb({
      8: [film(1, "Opération Raclette"), film(2, "Mariage à la plancha"), film(3, "Les Tontons du camping")],
      119: [film(2, "Mariage à la plancha")],
      337: [],
      381: [film(4, "Papy fait du parkour", { release_date: "" })],
    });

    const report = await syncCatalog(db, client, { now: new Date("2026-10-10T04:00:00Z") });

    expect(report).toMatchObject({
      moviesUpserted: 4,
      providerLinks: { netflix: 3, prime_video: 1, disney_plus: 0, canal_plus: 1 },
      linksRemoved: 0,
      runtimesFilled: 4,
    });
    expect(await rows("select movie_id, provider from movie_providers order by movie_id, provider")).toEqual([
      { movie_id: 1, provider: "netflix" },
      { movie_id: 2, provider: "netflix" },
      { movie_id: 2, provider: "prime_video" },
      { movie_id: 3, provider: "netflix" },
      { movie_id: 4, provider: "canal_plus" },
    ]);
    expect(await rows("select tmdb_id, release_year, runtime_minutes from movies where tmdb_id in (1, 4) order by tmdb_id")).toEqual([
      { tmdb_id: 1, release_year: 2021, runtime_minutes: 91 },
      { tmdb_id: 4, release_year: null, runtime_minutes: 94 },
    ]);
  });

  it("follows pagination", async () => {
    const many = Array.from({ length: 5 }, (_, i) => film(i + 1, `Film ${i + 1}`));
    const { client, calls } = fakeTmdb({ 8: many, 119: [], 337: [], 381: [] });

    await syncCatalog(db, client);

    expect(calls.filter((call) => call.providerIds.includes(8)).map((call) => call.page)).toEqual([1, 2, 3]);
    expect(await rows("select count(*)::int as n from movies")).toEqual([{ n: 5 }]);
  });

  it("updates films and drops platforms they left, keeping the films", async () => {
    await syncCatalog(db, fakeTmdb({ 8: [film(1, "Ancien titre")], 119: [film(1, "Ancien titre")], 337: [], 381: [] }).client, {
      now: new Date("2026-10-10T04:00:00Z"),
    });

    const report = await syncCatalog(
      db,
      fakeTmdb({ 8: [film(1, "Nouveau titre", { vote_average: 2.5 })], 119: [], 337: [], 381: [] }).client,
      { now: new Date("2026-10-11T04:00:00Z") },
    );

    expect(report.linksRemoved).toBe(1);
    expect(await rows("select provider from movie_providers")).toEqual([{ provider: "netflix" }]);
    expect(await rows("select title, tmdb_rating from movies")).toEqual([{ title: "Nouveau titre", tmdb_rating: 2.5 }]);
  });

  it("leaves yesterday's catalog untouched when TMDB fails mid-sync", async () => {
    await syncCatalog(db, fakeTmdb({ 8: [film(1, "A")], 119: [], 337: [], 381: [film(2, "B")] }).client, {
      now: new Date("2026-10-10T04:00:00Z"),
    });

    const failing = fakeTmdb({ 8: [], 119: [], 337: [], 381: [] }, { failOnProvider: 381 });
    await expect(syncCatalog(db, failing.client, { now: new Date("2026-10-11T04:00:00Z") })).rejects.toThrow(
      "TMDB is down",
    );

    expect(await rows("select movie_id, provider from movie_providers order by movie_id")).toEqual([
      { movie_id: 1, provider: "netflix" },
      { movie_id: 2, provider: "canal_plus" },
    ]);
  });

  it("caps runtime lookups per run and resumes next time", async () => {
    const catalog = { 8: [film(1, "A"), film(2, "B"), film(3, "C")], 119: [], 337: [], 381: [] };
    expect((await syncCatalog(db, fakeTmdb(catalog).client, { maxRuntimeLookups: 2 })).runtimesFilled).toBe(2);
    expect((await syncCatalog(db, fakeTmdb(catalog).client, { maxRuntimeLookups: 2 })).runtimesFilled).toBe(1);
  });
});
