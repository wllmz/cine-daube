import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { buttonClassName } from "@/components/ui/button";
import { getServerEnv } from "@/config/env";
import { getCurrentUser } from "@/features/auth/server";
import { InvitePanel, MemberList, formatInviteCode } from "@/features/rooms";
import { getRoomInvite, getRoomMembers } from "@/features/rooms/server";
import { formatShortDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Inviter · Ciné Daube" };

async function InviteContent({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, members, user] = await Promise.all([
    getRoomInvite(roomId),
    getRoomMembers(roomId),
    getCurrentUser(),
  ]);
  const inviteUrl = new URL(`/join/${room.inviteCode}`, getServerEnv().SITE_URL).toString();

  return (
    <>
      <header className="flex items-center gap-1">
        <BackLink href={`/rooms/${room.id}`} label={`Retour à ${room.name}`} />
        <h1 className="truncate text-[22px] font-extrabold tracking-tight">{room.name}</h1>
      </header>
      {/* Keyed by code: a new code resets the panel (copy and confirm states). */}
      <InvitePanel
        key={room.inviteCode}
        roomId={room.id}
        roomName={room.name}
        displayCode={formatInviteCode(room.inviteCode)}
        inviteUrl={inviteUrl}
        expiresLabel={formatShortDateTime(room.inviteExpiresAt)}
        isExpired={room.isExpired}
        isAdmin={room.role === "admin"}
      />
      <MemberList members={members} currentUserId={user.id} />
      <Link href={`/rooms/${room.id}`} className={buttonClassName("primary", "mt-auto")}>
        Ouvrir la room
      </Link>
    </>
  );
}

export default function InvitePage({ params }: PageProps<"/rooms/[roomId]/invite">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[360px] animate-pulse rounded-[20px] bg-chip" />}>
        <InviteContent params={params} />
      </Suspense>
    </main>
  );
}
