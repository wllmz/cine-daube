import type { StreamingProvider } from "./types";

/**
 * TMDB provider names per platform, matched case-insensitively against
 * /watch/providers/movie?watch_region=FR. Names rather than hardcoded ids:
 * TMDB adds variants (e.g. ad tiers) and ids are not documented per region.
 */
export const PROVIDER_NAMES: Record<StreamingProvider, readonly string[]> = {
  netflix: ["Netflix", "Netflix Standard with Ads", "Netflix basic with Ads"],
  prime_video: ["Amazon Prime Video", "Amazon Prime Video with Ads"],
  disney_plus: ["Disney Plus", "Disney+"],
  canal_plus: ["Canal+", "Canal Plus", "Canal+ Séries", "Canal+ Ciné Séries"],
};

export const PROVIDER_LABELS: Record<StreamingProvider, string> = {
  netflix: "Netflix",
  prime_video: "Prime Video",
  disney_plus: "Disney+",
  canal_plus: "Canal+",
};

export type TmdbProvider = { provider_id: number; provider_name: string };

/**
 * Maps each platform to its TMDB provider ids. Throws when a platform is
 * missing, so a renamed provider fails the sync loudly instead of silently
 * emptying that platform from the catalog.
 */
export function resolveProviderIds(
  available: readonly TmdbProvider[],
): Record<StreamingProvider, number[]> {
  const byName = new Map<string, number>();
  for (const provider of available) {
    byName.set(provider.provider_name.trim().toLowerCase(), provider.provider_id);
  }

  const entries = Object.entries(PROVIDER_NAMES).map(([platform, names]) => {
    const ids = names
      .map((name) => byName.get(name.toLowerCase()))
      .filter((id): id is number => id !== undefined);
    if (ids.length === 0) {
      throw new Error(`TMDB provider not found for ${platform} (looked for: ${names.join(", ")})`);
    }
    return [platform, ids] as const;
  });

  return Object.fromEntries(entries) as Record<StreamingProvider, number[]>;
}
