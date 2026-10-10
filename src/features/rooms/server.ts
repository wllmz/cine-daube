import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { getCurrentUser } from "@/features/auth/server";
import { roomIdSchema } from "./schemas";
import {
  findRoomByInviteCode,
  getRoomForMember,
  listRoomMembers,
  listRoomsForUser,
} from "./services/room-service";
import type { RoomDetails, RoomInvitePreview, RoomMember, RoomSummary } from "./types";

// Server-only public API of the rooms feature: every read goes through the
// current user, so a page can never load a room its visitor is not part of.

export async function getMyRooms(): Promise<RoomSummary[]> {
  const user = await getCurrentUser();
  return listRoomsForUser(getDb(), user.id);
}

/** The room if the current user is a member; a 404 otherwise (no existence leak). */
export const requireRoomMember = cache(async (roomId: string): Promise<RoomDetails> => {
  if (!roomIdSchema.safeParse(roomId).success) notFound();
  const user = await getCurrentUser();
  const room = await getRoomForMember(getDb(), roomId, user.id);
  if (!room) notFound();
  return room;
});

export async function getRoomMembers(roomId: string): Promise<RoomMember[]> {
  await requireRoomMember(roomId);
  return listRoomMembers(getDb(), roomId);
}

/** Expiry depends on the current time, so these reads always run at request time. */
async function isExpired(expiresAt: Date): Promise<boolean> {
  await connection();
  return expiresAt.getTime() <= Date.now();
}

/** Every member can see and share the room's code; only admins can replace it. */
export async function getRoomInvite(roomId: string): Promise<RoomDetails & { isExpired: boolean }> {
  const room = await requireRoomMember(roomId);
  return { ...room, isExpired: await isExpired(room.inviteExpiresAt) };
}

export type InvitePreview =
  | { status: "invalid" }
  | { status: "member"; roomId: string }
  | { status: "open"; room: RoomInvitePreview };

/**
 * What an invite link shows. Unknown and expired codes look the same, so the
 * page cannot be used to learn which codes exist; members go to their room.
 */
export async function getInvitePreview(code: string): Promise<InvitePreview> {
  const user = await getCurrentUser();
  const db = getDb();
  const room = await findRoomByInviteCode(db, code);
  if (!room) return { status: "invalid" };
  if (await getRoomForMember(db, room.id, user.id)) return { status: "member", roomId: room.id };
  if (await isExpired(room.inviteExpiresAt)) return { status: "invalid" };
  return { status: "open", room };
}
