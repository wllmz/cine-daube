// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import {
  castVote,
  getLatestSpin,
  markSeenAndRelaunch,
  startSpin,
} from "@/features/roulette/services/roulette-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

const NOW = new Date("2026-10-10T20:00:00Z");

let db: Database;
let pglite: PGlite;
let roomId: string;
let will: string;
let sarah: string;
let momo: string;
let julie: string;

async function seedMovies(ids: number[]) {
  for (const id of ids) {
    await pglite.query(
      "insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count, release_year, runtime_minutes) values ($1, $2, 6.1, 100, 2021, 94)",
      [id, `Film ${id}`],
    );
    await pglite.query("insert into movie_providers (movie_id, provider) values ($1, 'netflix')", [id]);
  }
}

async function rows(query: string) {
  return (await pglite.query<Record<string, unknown>>(query)).rows;
}

async function vote(userId: string, value: "yes" | "no", spinId: string) {
  return castVote(db, { spinId, roomId, userId, vote: value, now: NOW });
}

async function startedSpin(voterIds: string[]): Promise<string> {
  const result = await startSpin(db, { roomId, userId: will, voterIds, now: NOW });
  if (result.status !== "started") throw new Error(`Expected a started spin, got ${result.status}`);
  return result.spinId;
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  momo = await createUser(pglite, "Momo");
  julie = await createUser(pglite, "Julie");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", now: NOW, generateCode: () => "AAAAAAAA" }));
  for (const user of [sarah, momo, julie]) await joinRoom(db, { userId: user, code: "AAAAAAAA", now: NOW });
  await seedMovies([1, 2, 3]);
});

describe("startSpin", () => {
  it("draws an available film for the chosen voters", async () => {
    const spinId = await startedSpin([will, sarah, momo]);
    const spin = await getLatestSpin(db, roomId);

    expect(spin).toMatchObject({ id: spinId, status: "voting", launchedBy: "Will" });
    expect([1, 2, 3]).toContain(spin?.movie.tmdbId);
    expect(spin?.movie.providers).toEqual(["netflix"]);
    expect(spin?.voters.map((v) => [v.pseudo, v.vote])).toEqual([
      ["Momo", null],
      ["Sarah", null],
      ["Will", null],
    ]);
  });

  it("returns the spin already being voted on instead of starting another", async () => {
    const first = await startedSpin([will]);
    expect(await startSpin(db, { roomId, userId: sarah, voterIds: [sarah], now: NOW })).toEqual({
      status: "already_voting",
      spinId: first,
    });
  });

  it("never draws a film the room watched or already saw", async () => {
    await pglite.query(
      `insert into room_movies (room_id, movie_id, status) values ('${roomId}', 1, 'watched'), ('${roomId}', 2, 'seen_before')`,
    );
    await startedSpin([will]);
    expect((await getLatestSpin(db, roomId))?.movie.tmdbId).toBe(3);
  });

  it("never draws a film rated below 5.7 on TMDB", async () => {
    await pglite.query("update movies set tmdb_rating = 5.6 where tmdb_id in (1, 2)");
    await pglite.query("update movies set tmdb_rating = 5.7 where tmdb_id = 3");
    await startedSpin([will]);
    expect((await getLatestSpin(db, roomId))?.movie.tmdbId).toBe(3);
  });

  it("keeps a rejected film out of the draw for 24 hours", async () => {
    await pglite.query(`insert into room_movies (room_id, movie_id, status) values ('${roomId}', 2, 'watched'), ('${roomId}', 3, 'watched')`);
    const spinId = await startedSpin([will]);
    await vote(will, "no", spinId);

    expect(await startSpin(db, { roomId, userId: will, voterIds: [will], now: new Date(NOW.getTime() + 23 * 3600_000) })).toEqual({
      status: "empty_pool",
    });
    const later = await startSpin(db, { roomId, userId: will, voterIds: [will], now: new Date(NOW.getTime() + 25 * 3600_000) });
    expect(later.status).toBe("started");
  });

  it("unblocks a room whose spin lost all its voters", async () => {
    await startedSpin([julie]);
    await pglite.query(`delete from auth.users where id = '${julie}'`);

    const result = await startSpin(db, { roomId, userId: will, voterIds: [will], now: NOW });

    expect(result.status).toBe("started");
    expect(await rows(`select count(*)::int as n from spins where room_id = '${roomId}' and status = 'rejected'`)).toEqual([{ n: 1 }]);
  });

  it("says when the pool is empty", async () => {
    await pglite.query(`insert into room_movies (room_id, movie_id, status) select '${roomId}', tmdb_id, 'watched' from movies`);
    expect(await startSpin(db, { roomId, userId: will, voterIds: [will], now: NOW })).toEqual({ status: "empty_pool" });
  });

  it("only accepts room members as voters", async () => {
    const outsider = await createUser(pglite, "Intrus");
    await expect(startSpin(db, { roomId, userId: will, voterIds: [will, outsider], now: NOW })).rejects.toThrow();
    expect(await getLatestSpin(db, roomId)).toBeNull();
  });
});

describe("castVote", () => {
  it("accepts on majority: the film leaves the pool and becomes ratable", async () => {
    const spinId = await startedSpin([will, sarah, momo]);
    expect(await vote(will, "yes", spinId)).toEqual({ status: "voted", outcome: "pending" });
    expect(await vote(sarah, "yes", spinId)).toEqual({ status: "voted", outcome: "accepted" });

    const spin = await getLatestSpin(db, roomId);
    expect(spin?.status).toBe("accepted");
    expect(await rows(`select status from room_movies where room_id = '${roomId}'`)).toEqual([{ status: "watched" }]);
  });

  it("rejects on majority, without touching the pool", async () => {
    const spinId = await startedSpin([will, sarah, momo]);
    await vote(will, "no", spinId);
    expect(await vote(momo, "no", spinId)).toEqual({ status: "voted", outcome: "rejected" });
    expect((await getLatestSpin(db, roomId))?.status).toBe("rejected");
    expect(await rows("select * from room_movies")).toEqual([]);
  });

  it("lets a voter change their mind until the vote is closed", async () => {
    const spinId = await startedSpin([will, sarah, momo]);
    await vote(will, "no", spinId);
    await vote(will, "yes", spinId);
    expect(await vote(sarah, "yes", spinId)).toEqual({ status: "voted", outcome: "accepted" });
    expect(await vote(momo, "no", spinId)).toEqual({ status: "closed" });
  });

  it("spins again with the same voters on a tie", async () => {
    const spinId = await startedSpin([will, sarah]);
    await vote(will, "yes", spinId);
    const result = await vote(sarah, "no", spinId);

    expect(result).toMatchObject({ status: "voted", outcome: "tie" });
    const next = await getLatestSpin(db, roomId);
    expect(next?.id).not.toBe(spinId);
    expect(next?.status).toBe("voting");
    expect(next?.voters.map((v) => v.pseudo)).toEqual(["Sarah", "Will"]);
    // The tied film is not drawn again right away.
    expect(next?.movie.tmdbId).not.toBe((await rows(`select movie_id from spins where id = '${spinId}'`))[0]?.movie_id);
  });

  it("ignores members who were not chosen as voters", async () => {
    const spinId = await startedSpin([will, sarah]);
    expect(await vote(julie, "yes", spinId)).toEqual({ status: "not_voter" });
  });

  it("refuses votes on another room's spin", async () => {
    const spinId = await startedSpin([will]);
    const { id: otherRoom } = await createRoom(db, { userId: julie, name: "Autre", generateCode: () => "BBBBBBBB" });
    expect(await castVote(db, { spinId, roomId: otherRoom, userId: julie, vote: "yes" })).toEqual({ status: "closed" });
  });

  // PGlite has a single connection, so transactions are serialised here: this
  // checks the outcome logic, not the `for update` row lock itself.
  it("resolves concurrent votes exactly once", async () => {
    const spinId = await startedSpin([will, sarah, momo, julie]);
    const results = await Promise.all([vote(will, "yes", spinId), vote(sarah, "yes", spinId), vote(momo, "yes", spinId)]);
    expect(results.filter((r) => r.status === "voted" && r.outcome === "accepted")).toHaveLength(1);
    expect(await rows("select count(*)::int as n from room_movies")).toEqual([{ n: 1 }]);
  });
});

describe("markSeenAndRelaunch", () => {
  it("removes the film from the pool and spins again with the same voters", async () => {
    const spinId = await startedSpin([will, sarah]);
    const seenMovie = (await getLatestSpin(db, roomId))?.movie.tmdbId;

    const result = await markSeenAndRelaunch(db, { spinId, roomId, userId: sarah, now: NOW });

    expect(result.status).toBe("relaunched");
    expect(await rows(`select movie_id, status from room_movies`)).toEqual([{ movie_id: seenMovie, status: "seen_before" }]);
    const next = await getLatestSpin(db, roomId);
    expect(next).toMatchObject({ status: "voting", launchedBy: "Sarah" });
    expect(next?.movie.tmdbId).not.toBe(seenMovie);
  });

  it("is reserved to the voters of the spin", async () => {
    const spinId = await startedSpin([will, sarah]);
    expect(await markSeenAndRelaunch(db, { spinId, roomId, userId: julie, now: NOW })).toEqual({ status: "not_voter" });
    expect(await rows("select * from room_movies")).toEqual([]);
    expect((await getLatestSpin(db, roomId))?.id).toBe(spinId);
  });

  it("does nothing once the vote is over", async () => {
    const spinId = await startedSpin([will]);
    await vote(will, "yes", spinId);
    expect(await markSeenAndRelaunch(db, { spinId, roomId, userId: will, now: NOW })).toEqual({ status: "closed" });
  });
});
