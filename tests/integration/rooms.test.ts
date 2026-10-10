// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/db";
import {
  createRoom,
  findRoomByInviteCode,
  getRoomForMember,
  joinRoom,
  listRoomMembers,
  listRoomsForUser,
  regenerateInviteCode,
} from "@/features/rooms/services/room-service";
import { createTestDatabase, createUser } from "../helpers/test-database";

const NOW = new Date("2026-10-10T12:00:00Z");
const LATER = new Date("2026-10-18T12:00:00Z"); // after the 7-day validity

let db: Database;
let pglite: PGlite;
let will: string;
let sarah: string;

function codes(...values: string[]) {
  const queue = [...values];
  return () => queue.shift() ?? "ZZZZZZ";
}

beforeEach(async () => {
  ({ db, pglite } = await createTestDatabase());
  will = await createUser(pglite, "Will");
  sarah = await createUser(pglite, "Sarah");
});

describe("createRoom", () => {
  it("creates the room with its creator as admin and a 7-day invite", async () => {
    const { id } = await createRoom(db, { userId: will, name: "Les Nanardeurs", now: NOW, generateCode: codes("AAAAAA") });

    const room = await getRoomForMember(db, id, will);
    expect(room).toMatchObject({ name: "Les Nanardeurs", inviteCode: "AAAAAA", role: "admin" });
    expect(room?.inviteExpiresAt.toISOString()).toBe("2026-10-17T12:00:00.000Z");
  });

  it("retries with a new code when the first one is taken", async () => {
    await createRoom(db, { userId: will, name: "Première", generateCode: codes("AAAAAA") });
    const { id } = await createRoom(db, { userId: sarah, name: "Deuxième", generateCode: codes("AAAAAA", "BBBBBB") });

    expect((await getRoomForMember(db, id, sarah))?.inviteCode).toBe("BBBBBB");
    // The failed attempt left nothing behind.
    expect(await listRoomsForUser(db, sarah)).toHaveLength(1);
  });

  it("rejects a name the database would refuse", async () => {
    await expect(createRoom(db, { userId: will, name: "x".repeat(51) })).rejects.toThrow();
    expect(await listRoomsForUser(db, will)).toEqual([]);
  });
});

describe("joinRoom", () => {
  let roomId: string;

  beforeEach(async () => {
    ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", now: NOW, generateCode: codes("AAAAAA") }));
  });

  it("adds the user as a member", async () => {
    const result = await joinRoom(db, { userId: sarah, code: "AAAAAA", now: NOW });
    expect(result).toEqual({ status: "joined", roomId });
    expect(await getRoomForMember(db, roomId, sarah)).toMatchObject({ role: "member" });
  });

  it("is idempotent for existing members, admins keep their role", async () => {
    expect(await joinRoom(db, { userId: will, code: "AAAAAA", now: NOW })).toEqual({
      status: "already_member",
      roomId,
    });
    expect((await getRoomForMember(db, roomId, will))?.role).toBe("admin");
  });

  it("refuses unknown and expired codes", async () => {
    expect(await joinRoom(db, { userId: sarah, code: "ZZZZZZ", now: NOW })).toEqual({ status: "not_found" });
    expect(await joinRoom(db, { userId: sarah, code: "AAAAAA", now: LATER })).toEqual({ status: "expired" });
    expect(await getRoomForMember(db, roomId, sarah)).toBeNull();
  });
});

describe("reading rooms", () => {
  it("lists a user's rooms with counts and member previews", async () => {
    const { id } = await createRoom(db, { userId: will, name: "Les Nanardeurs", now: NOW, generateCode: codes("AAAAAA") });
    await joinRoom(db, { userId: sarah, code: "AAAAAA", now: NOW });

    const [room] = await listRoomsForUser(db, will);
    expect(room).toEqual({
      id,
      name: "Les Nanardeurs",
      role: "admin",
      memberCount: 2,
      watchedCount: 0,
      previewMembers: [
        { id: will, pseudo: "Will" },
        { id: sarah, pseudo: "Sarah" },
      ],
    });
    expect((await listRoomMembers(db, id)).map((member) => member.pseudo)).toEqual(["Will", "Sarah"]);
  });

  it("never shows a room to a non-member", async () => {
    const { id } = await createRoom(db, { userId: will, name: "Privée" });
    expect(await getRoomForMember(db, id, sarah)).toBeNull();
    expect(await listRoomsForUser(db, sarah)).toEqual([]);
  });

  it("previews a room from its invite code", async () => {
    await createRoom(db, { userId: will, name: "Les Nanardeurs", generateCode: codes("AAAAAA") });
    expect(await findRoomByInviteCode(db, "AAAAAA")).toMatchObject({ name: "Les Nanardeurs", memberCount: 1 });
    expect(await findRoomByInviteCode(db, "ZZZZZZ")).toBeNull();
  });
});

describe("regenerateInviteCode", () => {
  let roomId: string;

  beforeEach(async () => {
    ({ id: roomId } = await createRoom(db, { userId: will, name: "Les Nanardeurs", now: NOW, generateCode: codes("AAAAAA") }));
    await joinRoom(db, { userId: sarah, code: "AAAAAA", now: NOW });
  });

  it("lets the admin replace the code and restarts its validity", async () => {
    const result = await regenerateInviteCode(db, { roomId, userId: will, now: LATER, generateCode: codes("CCCCCC") });
    expect(result).toEqual({ inviteCode: "CCCCCC" });
    expect(await joinRoom(db, { userId: sarah, code: "AAAAAA", now: LATER })).toEqual({ status: "not_found" });
    expect((await getRoomForMember(db, roomId, will))?.inviteExpiresAt.toISOString()).toBe(
      "2026-10-25T12:00:00.000Z",
    );
  });

  it("refuses members who are not admin", async () => {
    expect(await regenerateInviteCode(db, { roomId, userId: sarah, generateCode: codes("CCCCCC") })).toBeNull();
    expect((await getRoomForMember(db, roomId, will))?.inviteCode).toBe("AAAAAA");
  });
});
