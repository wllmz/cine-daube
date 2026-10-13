import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Tomy } from "@/components/ui/tomy";
import { LeaderboardList } from "@/features/leaderboard";
import { getLeaderboard } from "@/features/leaderboard/server";
import { RoomTabs } from "@/features/ratings";
import { requireRoomMember } from "@/features/rooms/server";

export const metadata: Metadata = { title: "Classement · Ciné Daube" };

async function Leaderboard({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, { entries, currentUserId }] = await Promise.all([requireRoomMember(roomId), getLeaderboard(roomId)]);
  const leader = entries[0];

  return (
    <>
      <header className="flex items-center gap-1">
        <BackLink href="/rooms" label="Retour à mes rooms" />
        <h1 className="truncate text-[22px] font-extrabold tracking-tight">{room.name}</h1>
      </header>
      <RoomTabs roomId={room.id} active="leaderboard" />

      {leader && leader.points > 0 ? (
        <section className="flex items-center gap-2 rounded-[20px] bg-accent-soft py-2 pr-4 pl-1">
          <Tomy mood="content" size={72} />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-xs font-bold text-accent-strong">Madame Irma de la room</span>
            <strong className="text-base leading-tight font-bold">
              {entries
                .filter((entry) => entry.rank === 1)
                .map((entry) => entry.pseudo)
                .join(" et ")}
            </strong>
          </span>
          <span className="text-[26px] font-extrabold tracking-tight text-accent">{leader.points}</span>
        </section>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Tomy mood="choque" size={96} />
          <p className="text-sm leading-relaxed text-muted">
            Personne n&apos;a encore marqué. Faites vos prédictions pendant le prochain film : chaque prédiction validée
            par la room rapporte 1 point.
          </p>
        </div>
      )}

      <LeaderboardList entries={entries} currentUserId={currentUserId} />
    </>
  );
}

export default function LeaderboardPage({ params }: PageProps<"/rooms/[roomId]/leaderboard">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[420px] animate-pulse rounded-3xl bg-chip" />}>
        <Leaderboard params={params} />
      </Suspense>
    </main>
  );
}
