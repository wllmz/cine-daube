// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { createRoom, joinRoom } from "@/features/rooms/services/room-service";
import { castVote, startSpin } from "@/features/roulette/services/roulette-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

let db: Database;
let pglite: PGlite;
let roomId: string;
let will: string;
let sarah: string;
let outsider: string;

async function sent(): Promise<{ topic: string; event: string; payload: unknown }[]> {
  const result = await pglite.query<{ topic: string; event: string; payload: unknown }>(
    "select topic, event, payload from realtime.sent",
  );
  return result.rows;
}

/** Runs `query` as an authenticated Supabase user joined to `topic`. */
async function asUser<T>(userId: string, topic: string, query: string): Promise<T[]> {
  await pglite.exec(`
    select set_config('request.jwt.claim.sub', '${userId}', false);
    select set_config('realtime.topic', '${topic}', false);
    set role authenticated;
  `);
  try {
    return (await pglite.query<T>(query)).rows;
  } finally {
    await pglite.exec("reset role;");
  }
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
  outsider = await createUser(pglite, "Intrus");
  ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: () => "AAAAAAAA" }));
  await pglite.query("insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values (1, 'Film', 3, 100)");
  await pglite.query("insert into movie_providers (movie_id, provider) values (1, 'netflix')");
  await pglite.exec("delete from realtime.sent");
});

describe("database broadcasts", () => {
  it("tells the room when someone joins", async () => {
    await joinRoom(db, { userId: sarah, code: "AAAAAAAA" });
    expect(await sent()).toEqual([
      { topic: `room:${roomId}`, event: "room_changed", payload: { table: "room_members" } },
    ]);
  });

  it("tells the room about spins and votes, without leaking data", async () => {
    await joinRoom(db, { userId: sarah, code: "AAAAAAAA" });
    await pglite.exec("delete from realtime.sent");

    const spin = await startSpin(db, { roomId, userId: will, voterIds: [will, sarah] });
    if (spin.status !== "started") throw new Error("spin not started");
    await castVote(db, { spinId: spin.spinId, roomId, userId: will, vote: "yes" });

    const messages = await sent();
    expect(new Set(messages.map((m) => m.topic))).toEqual(new Set([`room:${roomId}`]));
    expect(messages.map((m) => m.payload)).toEqual([{ table: "spins" }, { table: "spin_votes" }]);
  });
});

describe("realtime channel policies", () => {
  const topic = () => `room:${roomId}`;

  it("lets members receive room events and track their presence", async () => {
    await asUser(will, topic(), `insert into realtime.messages (topic, extension) values ('${topic()}', 'presence')`);
    const visible = await asUser<{ topic: string }>(will, topic(), "select topic from realtime.messages");
    expect(visible).toHaveLength(1);
  });

  it("keeps outsiders out of a room's channel", async () => {
    await expect(
      asUser(outsider, topic(), `insert into realtime.messages (topic, extension) values ('${topic()}', 'presence')`),
    ).rejects.toThrow(/row-level security/);

    await pglite.query(`insert into realtime.messages (topic, extension) values ('${topic()}', 'broadcast')`);
    expect(await asUser(outsider, topic(), "select topic from realtime.messages")).toEqual([]);
  });

  it("does not let clients broadcast, only the database", async () => {
    await expect(
      asUser(will, topic(), `insert into realtime.messages (topic, extension) values ('${topic()}', 'broadcast')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("checks membership of the exact room in the topic", async () => {
    const { id: otherRoom } = await createRoom(db, { userId: outsider, name: "Autre", generateCode: () => "BBBBBBBB" });
    const check = (userId: string, t: string) =>
      asUser<{ ok: boolean }>(userId, t, `select public.is_room_member('${t}') as ok`).then((rows) => rows[0]?.ok);

    expect(await check(will, topic())).toBe(true);
    expect(await check(will, `room:${otherRoom}`)).toBe(false);
    expect(await check(will, "room:not-a-uuid")).toBe(false);
    expect(await check(will, `${topic()}x`)).toBe(false);
  });
});
