import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/ui/back-link";
import { PROVIDER_LABELS, tmdbPosterUrl } from "@/features/catalog";
import { RatingForm } from "@/features/ratings";
import { requireWatchedMovie } from "@/features/ratings/server";

export const metadata: Metadata = { title: "Noter · Ciné Daube" };

async function Rate({ params }: { params: Promise<{ roomId: string; movieId: string }> }) {
  const { roomId, movieId } = await params;
  const movie = await requireWatchedMovie(roomId, movieId);
  // Rated once the room has finished it.
  if (movie.finishedAt === null) redirect(`/rooms/${roomId}/movies/${movie.tmdbId}`);
  const meta = [movie.releaseYear, movie.providers.map((p) => PROVIDER_LABELS[p]).join(", ")].filter(Boolean).join(" · ");

  return (
    <>
      <header className="flex items-center gap-2.5">
        <BackLink href={`/rooms/${roomId}/movies/${movie.tmdbId}`} label="Retour au film" />
        <span className="relative h-[50px] w-9 shrink-0 overflow-hidden rounded-lg bg-chip">
          {movie.posterPath && (
            <Image src={tmdbPosterUrl(movie.posterPath, "w185")} alt="" fill sizes="36px" unoptimized className="object-cover" />
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-base font-bold">{movie.title}</h1>
          <span className="text-xs text-muted">{meta}</span>
        </div>
      </header>
      <RatingForm roomId={roomId} movieId={movie.tmdbId} initial={movie.myScores} />
    </>
  );
}

export default function RatePage({ params }: PageProps<"/rooms/[roomId]/movies/[movieId]/rate">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-5">
      <Suspense fallback={<div aria-hidden="true" className="h-[520px] animate-pulse rounded-3xl bg-chip" />}>
        <Rate params={params} />
      </Suspense>
    </main>
  );
}
