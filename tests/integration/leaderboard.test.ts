// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { getPointsByMovie, getRoomLeaderboard } from "@/features/leaderboard/services/leaderboard-service";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

let db: Database;
let pglite: PGlite;
let roomId: string;
let otherRoomId: string;
let will: string;
let sarah: string;
let momo: string;
let julie: string;

async function watch(room: string, movieId: number) {
  await pglite.query(
    "insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values ($1, $2, 3, 100) on conflict do nothing",
    [movieId, `Film ${movieId}`],
  );
  await pglite.query("insert into room_movies (room_id, movie_id, status, finished_at) values ($1, $2, 'watched', now())", [
    room,
    movieId,
  ]);
}

/** A prediction already judged by the room (null: still being judged). */
async function predicted(room: string, movieId: number, userId: string, validated: boolean | null) {
  await pglite.query(
    "insert into predictions (room_id, movie_id, user_id, content, validated, judged_at) values ($1, $2, $3, 'x', $4, $5)",
    [room, movieId, userId, validated, validated === null ? null : new Date()],
  );
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  momo = await createUser(pglite, "Momo");
  julie = await createUser(pglite, "Julie");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: () => "AAAAAAAA" }));
  for (const user of [sarah, momo, julie]) await joinRoom(db, { userId: user, code: "AAAAAAAA" });
  ({ id: otherRoomId } = await createRoom(db, { userId: will, name: "Autre room", generateCode: () => "BBBBBBBB" }));

  await watch(roomId, 1);
  await watch(roomId, 2);
  await watch(otherRoomId, 1);
  // Film 1: Will 2 right out of 3, Sarah 1 right, Momo 1 still judged.
  await predicted(roomId, 1, will, true);
  await predicted(roomId, 1, will, true);
  await predicted(roomId, 1, will, false);
  await predicted(roomId, 1, sarah, true);
  await predicted(roomId, 1, momo, null);
  // Film 2: Sarah 1 more; another room's points never count here.
  await predicted(roomId, 2, sarah, true);
  await predicted(otherRoomId, 1, will, true);
});

describe("getRoomLeaderboard", () => {
  it("adds up validated predictions over every film, ties sharing their rank", async () => {
    const entries = await getRoomLeaderboard(db, roomId);
    expect(entries.map((e) => [e.rank, e.pseudo, e.points, e.judged])).toEqual([
      [1, "Sarah", 2, 2],
      [1, "Will", 2, 3],
      [3, "Julie", 0, 0],
      [3, "Momo", 0, 0],
    ]);
  });
});

describe("getPointsByMovie", () => {
  it("gives the member's points per film of this room", async () => {
    expect(await getPointsByMovie(db, { roomId, userId: sarah })).toEqual(
      new Map([
        [1, 1],
        [2, 1],
      ]),
    );
    expect(await getPointsByMovie(db, { roomId, userId: will })).toEqual(new Map([[1, 2]]));
    expect(await getPointsByMovie(db, { roomId, userId: julie })).toEqual(new Map());
  });
});
