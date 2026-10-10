// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createTmdbClient, TmdbError } from "./tmdb-client";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const page = {
  page: 1,
  total_pages: 3,
  results: [
    {
      id: 42,
      title: "Opération Raclette",
      overview: "Trois cousins…",
      poster_path: "/abc.jpg",
      release_date: "2021-05-12",
      vote_average: 3.1,
      vote_count: 120,
      genre_ids: [35],
    },
  ],
};

describe("createTmdbClient", () => {
  it("queries French comedies included in the subscription", async () => {
    const fetch = vi.fn(async () => json(page));
    const client = createTmdbClient({ token: "secret-token", fetch });

    const result = await client.discoverFrenchComedies({ providerIds: [8, 1796], page: 2, minVoteCount: 20 });

    expect(result.results[0]?.title).toBe("Opération Raclette");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(new URL(url).pathname).toBe("/3/discover/movie");
    expect(Object.fromEntries(params)).toMatchObject({
      with_watch_providers: "8|1796",
      watch_region: "FR",
      with_watch_monetization_types: "flatrate",
      with_genres: "35",
      with_original_language: "fr",
      with_origin_country: "FR",
      "vote_count.gte": "20",
      page: "2",
    });
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("waits and retries when rate limited", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(json({ results: [{ provider_id: 8, provider_name: "Netflix" }] }));
    const client = createTmdbClient({ token: "t".repeat(20), fetch, sleep });

    expect(await client.listMovieProviders()).toEqual([{ provider_id: 8, provider_name: "Netflix" }]);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("retries server errors and network failures, with a timeout on every request", async () => {
    const sleep = vi.fn(async () => undefined);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ id: 42, runtime: 94 }));
    const client = createTmdbClient({ token: "t", fetch, sleep });

    expect(await client.getRuntime(42)).toBe(94);
    expect(fetch).toHaveBeenCalledTimes(3);
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("gives up after 3 attempts", async () => {
    const client = createTmdbClient({ token: "t", fetch: async () => json({}, 500), sleep: async () => undefined });
    await expect(client.getRuntime(42)).rejects.toMatchObject({ status: 500 });
  });

  it("sorts on a stable key so pages don't shift during a sync", async () => {
    const fetch = vi.fn(async () => json(page));
    await createTmdbClient({ token: "t", fetch }).discoverFrenchComedies({ providerIds: [8], page: 1, minVoteCount: 20 });
    const url = new URL((fetch.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("sort_by")).toBe("original_title.asc");
    expect(url.searchParams.has("region")).toBe(false);
  });

  it("fails clearly on errors and unexpected payloads", async () => {
    const client401 = createTmdbClient({ token: "bad", fetch: async () => json({}, 401) });
    await expect(client401.listMovieProviders()).rejects.toMatchObject({ status: 401 });

    const clientBad = createTmdbClient({ token: "t", fetch: async () => json({ nope: true }) });
    await expect(clientBad.listMovieProviders()).rejects.toBeInstanceOf(TmdbError);
  });

  it("treats a missing or zero runtime as unknown", async () => {
    const client = createTmdbClient({ token: "t", fetch: async () => json({ id: 42, runtime: 0 }) });
    expect(await client.getRuntime(42)).toBeNull();
  });
});
