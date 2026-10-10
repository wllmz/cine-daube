import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { PROVIDER_LABELS } from "@/features/catalog";
import {
  AutoRefresh,
  LaunchForm,
  MovieCard,
  RouletteWheel,
  SpinReveal,
  VotePanel,
  type CurrentSpin,
} from "@/features/roulette";
import { getRouletteState } from "@/features/roulette/server";

export const metadata: Metadata = { title: "Roulette · Ciné Daube" };

function idleMessage(spin: CurrentSpin | null): { title: string; subtitle: string } {
  if (spin?.status === "rejected") {
    return { title: "Recalé !", subtitle: `« ${spin.movie.title} » n'a pas convaincu. On relance ?` };
  }
  if (spin?.status === "seen") {
    return { title: "Plus rien à tirer", subtitle: "Vous avez épuisé le catalogue, bravo (ou pas)." };
  }
  return { title: "Prêts ?", subtitle: "Coche qui est là, la roue choisit la daube du soir." };
}

async function Roulette({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room, members, currentUserId, spin } = await getRouletteState(roomId);

  const header = (
    <header className="flex items-center gap-1">
      <BackLink href={`/rooms/${room.id}`} label={`Retour à ${room.name}`} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-xs text-muted">{room.name}</span>
        <h1 className="text-lg leading-tight font-extrabold tracking-tight">Roulette</h1>
      </div>
    </header>
  );

  if (spin?.status === "voting") {
    return (
      <>
        {header}
        <AutoRefresh />
        <SpinReveal spinId={spin.id}>
          <div className="flex flex-col gap-5">
            <p className="text-center text-sm text-muted">
              {spin.launchedBy ? `${spin.launchedBy} a lancé la roue.` : "La roue a parlé."} Et la daube est…
            </p>
            <MovieCard movie={spin.movie} />
            <VotePanel roomId={room.id} spinId={spin.id} voters={spin.voters} currentUserId={currentUserId} />
          </div>
        </SpinReveal>
      </>
    );
  }

  if (spin?.status === "accepted") {
    const platforms = spin.movie.providers.map((provider) => PROVIDER_LABELS[provider]).join(" ou ");
    return (
      <>
        {header}
        <SpinReveal spinId={spin.id}>
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2.5 rounded-[14px] bg-success-soft px-3.5 py-3 text-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-success" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              <span>
                <strong>C&apos;est validé !</strong> Lancez-le sur {platforms}. Bon courage.
              </span>
            </p>
            <MovieCard movie={spin.movie} />
            <p className="rounded-[14px] bg-subtle p-3.5 text-center text-[13px] text-muted">
              La notation du film arrive très vite.
            </p>
            <details className="rounded-[14px] border border-line p-3.5">
              <summary className="cursor-pointer text-sm font-semibold">Finalement, relancer une roulette</summary>
              <div className="mt-4">
                <LaunchForm roomId={room.id} members={members} label="Relancer la roulette" />
              </div>
            </details>
          </div>
        </SpinReveal>
      </>
    );
  }

  const { title, subtitle } = idleMessage(spin);
  return (
    <>
      {header}
      <div className="flex flex-col items-center gap-2 text-center">
        <RouletteWheel mood={spin?.status === "rejected" ? "degoute" : "content"} size={220} />
        <h2 className="mt-3 text-xl font-extrabold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <LaunchForm roomId={room.id} members={members} />
    </>
  );
}

export default function RoulettePage({ params }: PageProps<"/rooms/[roomId]/roulette">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[420px] animate-pulse rounded-3xl bg-chip" />}>
        <Roulette params={params} />
      </Suspense>
    </main>
  );
}
