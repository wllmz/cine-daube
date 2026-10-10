import Image from "next/image";
import { PROVIDER_LABELS, tmdbPosterUrl } from "@/features/catalog";
import { formatScore } from "@/lib/format";
import type { SpinMovie } from "../types";

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} h ${String(rest).padStart(2, "0")}` : `${rest} min`;
}

export function MovieCard({ movie }: { movie: SpinMovie }) {
  const meta = [movie.releaseYear, movie.runtimeMinutes ? formatRuntime(movie.runtimeMinutes) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex gap-4">
      <div className="relative h-[150px] w-[100px] shrink-0 overflow-hidden rounded-xl bg-chip shadow-[0_6px_16px_rgb(24_24_27/0.15)]">
        {movie.posterPath ? (
          <Image
            src={tmdbPosterUrl(movie.posterPath)}
            alt={`Affiche de ${movie.title}`}
            fill
            sizes="100px"
            // TMDB already serves sized images: no need to spend Vercel optimisations.
            unoptimized
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-end p-2 text-xs font-extrabold">{movie.title}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-xl leading-tight font-extrabold tracking-tight">{movie.title}</h2>
        {meta && <p className="text-[13px] text-muted">{meta}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">Dispo sur</span>
          {movie.providers.map((provider) => (
            <span key={provider} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold">
              {PROVIDER_LABELS[provider]}
            </span>
          ))}
        </div>
        <span className="self-start rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-soft">
          TMDB {formatScore(movie.tmdbRating)}/10
        </span>
        {movie.overview && (
          <p className="line-clamp-4 text-[13px] leading-relaxed text-ink-soft">{movie.overview}</p>
        )}
      </div>
    </article>
  );
}
