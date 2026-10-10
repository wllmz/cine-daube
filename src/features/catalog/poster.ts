const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TMDB poster URL; w342 is sharp on phones at the sizes the app uses. */
export function tmdbPosterUrl(posterPath: string, size: "w185" | "w342" = "w342"): string {
  return `${IMAGE_BASE}/${size}${posterPath}`;
}
