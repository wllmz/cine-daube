import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AvatarStack } from "@/components/ui/avatar";
import { BackLink } from "@/components/ui/back-link";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";
import { tmdbPosterUrl } from "@/features/catalog";
import { getFilmInProgress } from "@/features/predictions/server";
import { RoomTabs } from "@/features/ratings";
import { getNextToRate } from "@/features/ratings/server";
import { OnlineCount } from "@/features/realtime";
import { getRoomMembers, requireRoomMember } from "@/features/rooms/server";
import { AutoRefresh } from "@/features/roulette";
import { getLatestRoomSpin } from "@/features/roulette/server";
import { plural } from "@/lib/format";

export const metadata: Metadata = { title: "Room · Ciné Daube" };

async function Lobby({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const [room, members, spin, nextToRate, inProgress] = await Promise.all([
    requireRoomMember(roomId),
    getRoomMembers(roomId),
    getLatestRoomSpin(roomId),
    getNextToRate(roomId),
    getFilmInProgress(roomId),
  ]);
  const voting = spin?.status === "voting";
  // A film still on is rated once it is finished.
  const toRate = nextToRate?.tmdbId === inProgress?.tmdbId ? null : nextToRate;

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

      <RoomTabs roomId={room.id} active="lobby" />

      <div className="flex items-center gap-2.5">
        <AvatarStack people={members.slice(0, 6).map(({ id, pseudo }) => ({ id, pseudo }))} />
        <OnlineCount total={members.length} />
      </div>

      <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-surface px-5 pt-6 pb-5 text-center shadow-card">
        <Tomy mood="choque" size={112} />
        <h2 className="text-[22px] font-extrabold tracking-tight">La roulette de la honte</h2>
        <p className="text-sm leading-relaxed text-muted">
          {voting
            ? `Un vote est en cours sur « ${spin.movie.title} ».`
            : "Une comédie française au hasard, dispo sur une de ces plateformes."}
        </p>
        {!voting && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {["Netflix", "Prime Video", "Disney+", "Canal+"].map((platform) => (
              <span key={platform} className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-soft">
                {platform}
              </span>
            ))}
          </div>
        )}
        <Link href={`/rooms/${room.id}/roulette`} className={buttonClassName("primary", "mt-2 w-full")}>
          {voting ? "Rejoindre le vote" : "Lancer la roulette"}
        </Link>
      </section>

      {inProgress && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-semibold text-muted">Séance en cours</h2>
          <Link
            href={`/rooms/${room.id}/movies/${inProgress.tmdbId}`}
            className="flex items-center gap-3.5 rounded-[18px] bg-accent-soft p-3 transition hover:bg-[#fbe4e0]"
          >
            <span className="relative h-16 w-[46px] shrink-0 overflow-hidden rounded-[10px] bg-chip">
              {inProgress.posterPath && (
                <Image src={tmdbPosterUrl(inProgress.posterPath, "w185")} alt="" fill sizes="46px" unoptimized className="object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <strong className="truncate text-[15px] font-bold">{inProgress.title}</strong>
              <span className="text-xs text-muted">Prédictions ouvertes jusqu&apos;à la fin du film</span>
            </span>
            <span className="rounded-[10px] bg-surface px-3.5 py-2 text-sm font-semibold shadow-[0_1px_3px_rgb(24_24_27/0.1)]">
              Prédire
            </span>
          </Link>
        </section>
      )}

      {toRate && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[13px] font-semibold text-muted">À noter</h2>
          <Link
            href={`/rooms/${room.id}/movies/${toRate.tmdbId}/rate`}
            className="flex items-center gap-3.5 rounded-[18px] bg-subtle p-3 transition hover:bg-chip"
          >
            <span className="relative h-16 w-[46px] shrink-0 overflow-hidden rounded-[10px] bg-chip">
              {toRate.posterPath && (
                <Image src={tmdbPosterUrl(toRate.posterPath, "w185")} alt="" fill sizes="46px" unoptimized className="object-cover" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <strong className="truncate text-[15px] font-bold">{toRate.title}</strong>
              <span className="text-xs text-muted">
                {toRate.summary.count > 0
                  ? `${plural(toRate.summary.count, "note")}, il manque la tienne`
                  : "Personne ne l'a encore noté"}
              </span>
            </span>
            <span className="rounded-[10px] bg-surface px-3.5 py-2 text-sm font-semibold shadow-[0_1px_3px_rgb(24_24_27/0.1)]">
              Noter
            </span>
          </Link>
        </section>
      )}

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
      {/* Realtime pushes changes; this slow poll only covers a dropped connection. */}
      <AutoRefresh intervalMs={30_000} />
      <Suspense fallback={<div aria-hidden="true" className="h-[360px] animate-pulse rounded-3xl bg-chip" />}>
        <Lobby params={params} />
      </Suspense>
    </main>
  );
}
