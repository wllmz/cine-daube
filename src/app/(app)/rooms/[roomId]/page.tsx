import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvatarStack } from "@/components/ui/avatar";
import { BackLink } from "@/components/ui/back-link";
import { Tomy } from "@/components/ui/tomy";
import { getRoomMembers, requireRoomMember } from "@/features/rooms/server";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Room · Ciné Daube" };

async function Lobby({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, members] = await Promise.all([requireRoomMember(roomId), getRoomMembers(roomId)]);

  return (
    <>
      <header className="flex items-center gap-1">
        <BackLink href="/rooms" label="Retour à mes rooms" />
        <h1 className="flex-1 truncate text-[22px] font-extrabold tracking-tight">{room.name}</h1>
        <Link
          href={`/rooms/${room.id}/invite`}
          aria-label="Inviter des potes"
          className="flex size-11 items-center justify-center rounded-full bg-chip text-ink hover:bg-line"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="4" />
            <path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />
          </svg>
        </Link>
      </header>

      <div className="flex items-center gap-2.5">
        <AvatarStack people={members.slice(0, 6).map(({ id, pseudo }) => ({ id, pseudo }))} />
        <span className="text-[13px] text-muted">{plural(members.length, "membre")}</span>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-5 pt-6 pb-5 text-center shadow-card">
        <Tomy mood="choque" size={112} />
        <h2 className="text-[22px] font-extrabold tracking-tight">La roulette de la honte</h2>
        <p className="text-sm leading-relaxed text-muted">
          Bientôt ici : une comédie française tirée au sort parmi Netflix, Prime Video, Disney+ et Canal+.
        </p>
      </section>

      {members.length === 1 && (
        <Link
          href={`/rooms/${room.id}/invite`}
          className="rounded-[18px] bg-accent-soft p-4 text-center text-sm font-semibold text-accent-strong"
        >
          Tu es seul ici pour l&apos;instant : invite tes potes →
        </Link>
      )}
    </>
  );
}

export default function RoomPage({ params }: PageProps<"/rooms/[roomId]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[360px] animate-pulse rounded-3xl bg-chip" />}>
        <Lobby params={params} />
      </Suspense>
    </main>
  );
}
