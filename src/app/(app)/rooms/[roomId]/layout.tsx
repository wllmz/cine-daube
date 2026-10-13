import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/features/auth/server";
import { FinishVoteBanner } from "@/features/predictions";
import { getPendingFinishVotes } from "@/features/predictions/server";
import { RoomRealtime } from "@/features/realtime";
import { requireRoomMember } from "@/features/rooms/server";

async function RoomChannel({ params, children }: { params: Promise<{ roomId: string }>; children: ReactNode }) {
  const { roomId } = await params;
  // Members only: the 404 comes before anyone tries to join the channel.
  const [room, user, finishVotes] = await Promise.all([
    requireRoomMember(roomId),
    getCurrentUser(),
    getPendingFinishVotes(roomId),
  ]);
  return (
    <RoomRealtime roomId={room.id} currentUserId={user.id}>
      {children}
      {/* "Film terminé ?" asked on any page of the room. */}
      <FinishVoteBanner roomId={room.id} votes={finishVotes} />
    </RoomRealtime>
  );
}

/**
 * One realtime subscription for all the room's pages (lobby, roulette,
 * invite): it stays mounted while moving between them.
 */
export default function RoomLayout({ params, children }: LayoutProps<"/rooms/[roomId]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="mx-auto h-[420px] w-full max-w-md animate-pulse rounded-3xl bg-chip" />}>
      <RoomChannel params={params}>{children}</RoomChannel>
    </Suspense>
  );
}
