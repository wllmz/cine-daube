import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Tomy } from "@/components/ui/tomy";
import { requireRoomMember } from "@/features/rooms/server";
import { MovieRow, RoomTabs, sortByScore, type MovieSort } from "@/features/ratings";
import { getWatchedMovies } from "@/features/ratings/server";
import { formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Films vus · Ciné Daube" };

const SORTS: { key: MovieSort; label: string }[] = [
  { key: "worst", label: "Pires d'abord" },
  { key: "recent", label: "Récents" },
  { key: "best", label: "Meilleurs" },
];

function Stat({ value, label, dashed = false }: { value: string; label: string; dashed?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[14px] p-3", dashed ? "border border-dashed border-faint" : "bg-subtle")}>
      <strong className="text-[22px] font-extrabold">{value}</strong>
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  );
}

async function Movies({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const sort: MovieSort = SORTS.find((s) => s.key === query.sort)?.key ?? "worst";
  const [room, { movies, stats }] = await Promise.all([requireRoomMember(roomId), getWatchedMovies(roomId)]);
  const sorted = sortByScore(movies, sort);

  return (
    <>
      <header className="flex items-center gap-1">
        <BackLink href="/rooms" label="Retour à mes rooms" />
        <h1 className="truncate text-[22px] font-extrabold tracking-tight">{room.name}</h1>
      </header>
      <RoomTabs roomId={room.id} active="movies" />

      {movies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Tomy mood="choque" size={112} />
          <p className="text-sm leading-relaxed text-muted">
            Aucun film vu pour l&apos;instant. Lancez la roulette et validez votre première daube.
          </p>
        </div>
      ) : (
        <>
          {stats.navet && stats.navet.summary.average !== null && (
            <Link
              href={`/rooms/${room.id}/movies/${stats.navet.tmdbId}`}
              className="flex items-center gap-2 rounded-[20px] bg-accent-soft py-2 pr-4 pl-1 transition hover:-translate-y-0.5"
            >
              <Tomy mood="degoute" size={72} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-xs font-bold text-accent-strong">Navet d&apos;Or</span>
                <strong className="text-base leading-tight font-bold">{stats.navet.title}</strong>
              </span>
              <span className="text-[26px] font-extrabold tracking-tight text-accent">
                {formatScore(stats.navet.summary.average)}
              </span>
            </Link>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat value={String(stats.watchedCount)} label={stats.watchedCount > 1 ? "films vus" : "film vu"} />
            <Stat value={stats.roomAverage === null ? "—" : formatScore(stats.roomAverage)} label="moyenne room" />
            <Stat value={stats.actingAverage === null ? "—" : formatScore(stats.actingAverage)} label="bonus acteurs" dashed />
          </div>

          <nav aria-label="Trier les films" className="flex gap-1.5">
            {SORTS.map((option) => (
              <Link
                key={option.key}
                href={`/rooms/${room.id}/movies?sort=${option.key}`}
                aria-current={option.key === sort ? "true" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold transition",
                  option.key === sort ? "bg-ink text-white" : "bg-chip text-ink-soft hover:bg-line",
                )}
              >
                {option.label}
              </Link>
            ))}
          </nav>

          <ol className="-mx-2.5 flex flex-col gap-0.5">
            {sorted.map((movie, index) => (
              <li key={movie.tmdbId}>
                <MovieRow roomId={room.id} movie={movie} rank={index + 1} />
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

export default function MoviesPage({ params, searchParams }: PageProps<"/rooms/[roomId]/movies">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[420px] animate-pulse rounded-3xl bg-chip" />}>
        <Movies params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
