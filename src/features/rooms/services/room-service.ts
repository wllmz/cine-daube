import "server-only";
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { profiles, roomMembers, roomMovies, rooms } from "@/db/schema";
import { generateInviteCode, inviteExpiryFrom } from "../invite-code";
import type {
  JoinRoomResult,
  RoomDetails,
  RoomInvitePreview,
  RoomMember,
  RoomSummary,
} from "../types";

const MAX_CODE_ATTEMPTS = 5;
const PREVIEW_MEMBERS = 4;

const memberCount = sql<number>`(select count(*)::int from ${roomMembers} as m where m.room_id = ${rooms.id})`;
const watchedCount = sql<number>`(select count(*)::int from ${roomMovies} as rm where rm.room_id = ${rooms.id} and rm.status = 'watched')`;

/** Rooms the user belongs to, most recently joined first. */
export async function listRoomsForUser(db: Database, userId: string): Promise<RoomSummary[]> {
  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      role: roomMembers.role,
      memberCount,
      watchedCount,
    })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(eq(roomMembers.userId, userId))
    .orderBy(desc(roomMembers.joinedAt));

  if (rows.length === 0) return [];

  const members = await db
    .select({ roomId: roomMembers.roomId, userId: roomMembers.userId, pseudo: profiles.pseudo })
    .from(roomMembers)
    .innerJoin(profiles, eq(profiles.id, roomMembers.userId))
    .where(inArray(roomMembers.roomId, rows.map((row) => row.id)))
    .orderBy(asc(roomMembers.joinedAt));

  return rows.map((row) => ({
    ...row,
    previewMembers: members
      .filter((member) => member.roomId === row.id)
      .slice(0, PREVIEW_MEMBERS)
      .map(({ userId: id, pseudo }) => ({ id, pseudo })),
  }));
}

/** The room as seen by one of its members, or null if they are not a member. */
export async function getRoomForMember(
  db: Database,
  roomId: string,
  userId: string,
): Promise<RoomDetails | null> {
  const [room] = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      inviteCode: rooms.inviteCode,
      inviteExpiresAt: rooms.inviteExpiresAt,
      role: roomMembers.role,
    })
    .from(rooms)
    .innerJoin(roomMembers, and(eq(roomMembers.roomId, rooms.id), eq(roomMembers.userId, userId)))
    .where(eq(rooms.id, roomId))
    .limit(1);
  return room ?? null;
}

export async function listRoomMembers(db: Database, roomId: string): Promise<RoomMember[]> {
  return db
    .select({
      id: roomMembers.userId,
      pseudo: profiles.pseudo,
      role: roomMembers.role,
      joinedAt: roomMembers.joinedAt,
    })
    .from(roomMembers)
    .innerJoin(profiles, eq(profiles.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, roomId))
    .orderBy(asc(roomMembers.joinedAt));
}

/** What someone holding an invite code may see before joining. */
export async function findRoomByInviteCode(
  db: Database,
  code: string,
): Promise<RoomInvitePreview | null> {
  const [room] = await db
    .select({ id: rooms.id, name: rooms.name, inviteExpiresAt: rooms.inviteExpiresAt, memberCount })
    .from(rooms)
    .where(eq(rooms.inviteCode, code))
    .limit(1);
  return room ?? null;
}

/** Runs `write` with fresh invite codes until one is not already taken. */
async function withUniqueInviteCode<T>(
  generateCode: () => string,
  write: (code: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await write(generateCode());
    } catch (error) {
      if (attempt >= MAX_CODE_ATTEMPTS || !isUniqueViolation(error, "rooms_invite_code_unique")) {
        throw error;
      }
    }
  }
}

/** Creates a room with its creator as admin, in one transaction. */
export async function createRoom(
  db: Database,
  input: { userId: string; name: string; now?: Date; generateCode?: () => string },
): Promise<{ id: string }> {
  const now = input.now ?? new Date();
  return withUniqueInviteCode(input.generateCode ?? generateInviteCode, (inviteCode) =>
    db.transaction(async (tx) => {
      const [room] = await tx
        .insert(rooms)
        .values({ name: input.name, inviteCode, inviteExpiresAt: inviteExpiryFrom(now) })
        .returning({ id: rooms.id });
      if (!room) throw new Error("Room insert returned no row");
      await tx.insert(roomMembers).values({ roomId: room.id, userId: input.userId, role: "admin" });
      return room;
    }),
  );
}

/**
 * Joins with a single INSERT … SELECT: the code and its expiry are checked in
 * the same statement that writes the membership, so a code replaced by the
 * admin a millisecond earlier can no longer be used.
 */
export async function joinRoom(
  db: Database,
  input: { userId: string; code: string; now?: Date },
): Promise<JoinRoomResult> {
  const now = input.now ?? new Date();
  const inserted = await db
    .insert(roomMembers)
    .select(
      db
        .select({
          roomId: rooms.id,
          userId: sql<string>`${input.userId}::uuid`.as("user_id"),
          role: sql<"member">`'member'::member_role`.as("role"),
          // Drizzle requires every column, in table order.
          joinedAt: sql<Date>`now()`.as("joined_at"),
        })
        .from(rooms)
        .where(and(eq(rooms.inviteCode, input.code), gt(rooms.inviteExpiresAt, now))),
    )
    .onConflictDoNothing()
    .returning({ roomId: roomMembers.roomId });

  const joined = inserted[0];
  if (joined) return { status: "joined", roomId: joined.roomId };

  // Nothing inserted: find out why, for the user.
  const room = await findRoomByInviteCode(db, input.code);
  if (!room) return { status: "not_found" };
  if (await getRoomForMember(db, room.id, input.userId)) {
    return { status: "already_member", roomId: room.id };
  }
  return { status: "expired" };
}

/** Replaces the invite code (and restarts its validity). Admins only. */
export async function regenerateInviteCode(
  db: Database,
  input: { roomId: string; userId: string; now?: Date; generateCode?: () => string },
): Promise<{ inviteCode: string } | null> {
  const now = input.now ?? new Date();
  const isAdmin = db
    .select({ one: sql`1` })
    .from(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, input.roomId),
        eq(roomMembers.userId, input.userId),
        eq(roomMembers.role, "admin"),
      ),
    );

  const [room] = await withUniqueInviteCode(input.generateCode ?? generateInviteCode, (inviteCode) =>
    db
      .update(rooms)
      .set({ inviteCode, inviteExpiresAt: inviteExpiryFrom(now) })
      .where(and(eq(rooms.id, input.roomId), sql`exists (${isAdmin})`))
      .returning({ inviteCode: rooms.inviteCode }),
  );
  return room ?? null;
}
