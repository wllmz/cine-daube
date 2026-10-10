export const STREAMING_PROVIDERS = ["netflix", "prime_video", "disney_plus", "canal_plus"] as const;

export type StreamingProvider = (typeof STREAMING_PROVIDERS)[number];

/** Why a platform's stale links were kept instead of removed. */
export type IncompleteReason = "truncated" | "suspicious_drop";

export type SyncReport = {
  moviesUpserted: number;
  providerLinks: Record<StreamingProvider, number>;
  linksRemoved: number;
  /** Platforms whose fetch looked partial: their old links were kept. */
  incompletePlatforms: Partial<Record<StreamingProvider, IncompleteReason>>;
  runtimesFilled: number;
  runtimeErrors: number;
  durationMs: number;
};

export class SyncAlreadyRunningError extends Error {
  constructor() {
    super("Another catalog sync is already writing");
  }
}
