// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import {
  computeRoomStats,
  getMovieDetail,
  listWatchedMovies,
  saveRating,
} from "@/features/ratings/services/rating-service";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

let db: Database;
let pglite: PGlite;
let roomId: string;
let will: string;
let sarah: string;
let momo: string;

async function watch(movieId: number, title: string, at: string, status = "watched") {
  await pglite.query(
    "insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count, release_year) values ($1, $2, 3, 100, 2023) on conflict do nothing",
    [movieId, title],
  );
  await pglite.query("insert into movie_providers (movie_id, provider) values ($1, 'canal_plus') on conflict do nothing", [movieId]);
  await pglite.query("insert into room_movies (room_id, movie_id, status, created_at) values ($1, $2, $3, $4)", [
    roomId,
    movieId,
    status,
    at,
  ]);
}

const rate = (userId: string, movieId: number, humour: number, scenario: number, acting: number | null = null) =>
  saveRating(db, { roomId, movieId, userId, scores: { humour, scenario, acting } });

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  momo = await createUser(pglite, "Momo");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: () => "AAAAAAAA" }));
  await joinRoom(db, { userId: sarah, code: "AAAAAAAA" });
  await joinRoom(db, { userId: momo, code: "AAAAAAAA" });
});

describe("saveRating", () => {
  it("creates then updates a member's rating", async () => {
    await watch(1, "Mariage à la plancha", "2026-09-21T20:00:00Z");
    await rate(will, 1, 2, 1, 3);
    await rate(will, 1, 4, 3, null);

    const detail = await getMovieDetail(db, { roomId, movieId: 1, userId: will });
    expect(detail?.myScores).toEqual({ humour: 4, scenario: 3, acting: null });
    expect(detail?.summary.count).toBe(1);
  });

  it("refuses ratings on a film the room only marked as already seen", async () => {
    await watch(2, "Déjà vu", "2026-09-21T20:00:00Z", "seen_before");
    await expect(rate(will, 2, 5, 5)).rejects.toThrow();
  });

  it("refuses ratings from outside the room and out of range", async () => {
    await watch(1, "Mariage à la plancha", "2026-09-21T20:00:00Z");
    const outsider = await createUser(pglite, "Intrus");
    await expect(rate(outsider, 1, 5, 5)).rejects.toThrow();
    await expect(rate(will, 1, 11, 5)).rejects.toThrow();
  });
});

describe("listWatchedMovies and stats", () => {
  beforeEach(async () => {
    await watch(1, "Mariage à la plancha", "2026-09-21T20:00:00Z");
    await watch(2, "Les Bronzettes", "2026-08-24T20:00:00Z");
    await watch(3, "Pas encore noté", "2026-10-05T20:00:00Z");
    await watch(4, "Déjà vu", "2026-10-01T20:00:00Z", "seen_before");
    // Three members rate film 1, one rates film 2, nobody rates film 3.
    await rate(will, 1, 2, 1, 3);
    await rate(sarah, 1, 3, 2);
    await rate(momo, 1, 1, 2, 4);
    await rate(sarah, 2, 6, 5, 7);
  });

  it("lists only watched films, newest first, with their scores", async () => {
    const watched = await listWatchedMovies(db, roomId, will);
    expect(watched.map((movie) => movie.title)).toEqual(["Pas encore noté", "Mariage à la plancha", "Les Bronzettes"]);

    const plancha = watched.find((movie) => movie.tmdbId === 1);
    expect(plancha).toMatchObject({ providers: ["canal_plus"], ratedByMe: true });
    expect(plancha?.summary.average).toBeCloseTo(1.833, 2);
    expect(watched.find((movie) => movie.tmdbId === 2)?.ratedByMe).toBe(false);
    expect(watched.find((movie) => movie.tmdbId === 3)?.summary.average).toBeNull();
  });

  it("computes the room average, the bonus average and the Navet d'Or", async () => {
    const stats = computeRoomStats(await listWatchedMovies(db, roomId, will));
    expect(stats.watchedCount).toBe(3);
    expect(stats.navet?.title).toBe("Mariage à la plancha");
    // (1.833… + 5.5) / 2, unrated films ignored.
    expect(stats.roomAverage).toBeCloseTo(3.667, 2);
    // Every bonus counts once: (3 + 4 + 7) / 3.
    expect(stats.actingAverage).toBeCloseTo(4.667, 2);
  });

  it("details every member, including those who have not rated", async () => {
    const detail = await getMovieDetail(db, { roomId, movieId: 2, userId: will });
    expect(detail?.ratings.map((r) => [r.pseudo, r.scores])).toEqual([
      ["Will", null],
      ["Sarah", { humour: 6, scenario: 5, acting: 7 }],
      ["Momo", null],
    ]);
    expect(detail?.myScores).toBeNull();
  });

  it("does not detail a film the room did not watch", async () => {
    expect(await getMovieDetail(db, { roomId, movieId: 4, userId: will })).toBeNull();
    expect(await getMovieDetail(db, { roomId, movieId: 999, userId: will })).toBeNull();
  });

  it("tells the room when ratings change", async () => {
    await pglite.exec("delete from realtime.sent");
    await rate(will, 2, 4, 4);
    const sent = await pglite.query<{ payload: unknown }>("select payload from realtime.sent");
    expect(sent.rows).toEqual([{ payload: { table: "ratings" } }]);
  });
});
