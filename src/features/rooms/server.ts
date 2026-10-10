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

export async function getRoomInvite(roomId: string): Promise<RoomDetails & { isExpired: boolean }> {
  const room = await requireRoomMember(roomId);
  return { ...room, isExpired: await isExpired(room.inviteExpiresAt) };
}

export async function getInvitePreview(
  code: string,
): Promise<(RoomInvitePreview & { isExpired: boolean }) | null> {
  await getCurrentUser();
  const room = await findRoomByInviteCode(getDb(), code);
  return room && { ...room, isExpired: await isExpired(room.inviteExpiresAt) };
}
