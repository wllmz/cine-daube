import Image from "next/image";
import Link from "next/link";
import { PROVIDER_LABELS, tmdbPosterUrl } from "@/features/catalog";
import { formatScore, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WatchedMovie } from "../types";

export function MovieRow({ roomId, movie, rank }: { roomId: string; movie: WatchedMovie; rank: number }) {
  const average = movie.summary.average;
  const provider = movie.providers[0];

  return (
    <Link
      href={`/rooms/${roomId}/movies/${movie.tmdbId}`}
      className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="w-4 text-center text-xs font-semibold text-faint">{rank}</span>
      <span className="relative h-[50px] w-9 shrink-0 overflow-hidden rounded-lg bg-chip">
        {movie.posterPath && (
          <Image src={tmdbPosterUrl(movie.posterPath, "w185")} alt="" fill sizes="36px" unoptimized className="object-cover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <strong className="truncate text-sm font-bold">{movie.title}</strong>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          {provider && (
            <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-ink">{PROVIDER_LABELS[provider]}</span>
          )}
          vu le {formatShortDate(movie.watchedAt)}
          {movie.finishedAt === null ? (
            <span className="font-semibold text-accent-strong">· en cours</span>
          ) : (
            !movie.ratedByMe && <span className="font-semibold text-accent-strong">· à noter</span>
          )}
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-[#f0f0ee]">
          <span
            className={cn("block h-full rounded-full", average !== null && average < 3 ? "bg-accent" : "bg-[#f08c78]")}
            style={{ width: `${(average ?? 0) * 10}%` }}
          />
        </span>
      </span>
      <span className="min-w-9 text-right text-lg font-extrabold">
        {average === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">pas encore noté</span>
          </>
        ) : (
          <>
            <span className="sr-only">moyenne </span>
            {formatScore(average)}
          </>
        )}
      </span>
    </Link>
  );
}
