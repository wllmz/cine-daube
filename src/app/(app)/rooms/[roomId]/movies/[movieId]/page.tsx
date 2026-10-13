import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { buttonClassName } from "@/components/ui/button";
import { Tomy } from "@/components/ui/tomy";
import { getCurrentUser } from "@/features/auth/server";
import { PROVIDER_LABELS, tmdbPosterUrl } from "@/features/catalog";
import { PredictionSession, RevealedPredictions } from "@/features/predictions";
import { requirePredictionBoard } from "@/features/predictions/server";
import { MemberRatings, verdict } from "@/features/ratings";
import { requireWatchedMovie } from "@/features/ratings/server";
import { formatScore, formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Film · Ciné Daube" };

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="w-16 font-semibold">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0f0ee]">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${(value ?? 0) * 10}%` }} />
      </span>
      <span className="w-7 text-right font-bold">{value === null ? "—" : formatScore(value)}</span>
    </div>
  );
}

async function MovieDetailView({ params }: { params: Promise<{ roomId: string; movieId: string }> }) {
  const { roomId, movieId } = await params;
  const [movie, board, user] = await Promise.all([
    requireWatchedMovie(roomId, movieId),
    requirePredictionBoard(roomId, movieId),
    getCurrentUser(),
  ]);
  const { summary } = movie;
  const platforms = movie.providers.map((provider) => PROVIDER_LABELS[provider]).join(", ");
  const meta = [movie.releaseYear, platforms, `vu le ${formatShortDate(movie.watchedAt)}`].filter(Boolean).join(" · ");

  return (
    <>
      <header className="flex items-center gap-1">
        <BackLink href={`/rooms/${roomId}/movies`} label="Retour aux films vus" />
        <span className="text-sm font-semibold text-muted">Films vus</span>
      </header>

      <section className="flex gap-4">
        <div className="relative h-[150px] w-[100px] shrink-0 overflow-hidden rounded-xl bg-chip shadow-[0_6px_16px_rgb(24_24_27/0.15)]">
          {movie.posterPath && (
            <Image src={tmdbPosterUrl(movie.posterPath)} alt={`Affiche de ${movie.title}`} fill sizes="100px" unoptimized className="object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight">{movie.title}</h1>
          <p className="text-[13px] text-muted">{meta}</p>
          {movie.overview && <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{movie.overview}</p>}
        </div>
      </section>

      {!board.finishedAt && <PredictionSession roomId={roomId} board={board} currentUserId={user.id} />}

      <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[18px] shadow-card">
        {summary.average === null ? (
          <div className="flex items-center gap-3">
            <Tomy mood="choque" size={64} />
            <p className="text-sm text-muted">Personne n&apos;a encore noté ce film. À toi l&apos;honneur.</p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-muted">Moyenne de la room</span>
                <span className="leading-none font-extrabold tracking-tight">
                  <span className="text-[44px] text-accent">{formatScore(summary.average)}</span>
                  <span className="text-lg text-muted"> /10</span>
                </span>
              </div>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-strong">
                {verdict(summary.average)}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <ScoreBar label="Humour" value={summary.humour} />
              <ScoreBar label="Scénario" value={summary.scenario} />
            </div>
            <div className="flex items-center justify-between border-t border-[#f0f0ee] pt-3 text-[13px]">
              <span>
                <strong className="font-semibold">Jeu d&apos;acteur</strong>{" "}
                <span className="text-muted">· bonus, hors moyenne</span>
              </span>
              <strong>{summary.acting === null ? "—" : formatScore(summary.acting)}</strong>
            </div>
          </>
        )}
      </section>

      {board.finishedAt && (
        <Link href={`/rooms/${roomId}/movies/${movie.tmdbId}/rate`} className={buttonClassName(movie.myScores ? "secondary" : "primary")}>
          {movie.myScores ? "Modifier ma note" : "Noter ce film"}
        </Link>
      )}

      <MemberRatings ratings={movie.ratings} />

      {board.finishedAt && <RevealedPredictions authors={board.revealed} />}
    </>
  );
}

export default function MoviePage({ params }: PageProps<"/rooms/[roomId]/movies/[movieId]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[420px] animate-pulse rounded-3xl bg-chip" />}>
        <MovieDetailView params={params} />
      </Suspense>
    </main>
  );
}
