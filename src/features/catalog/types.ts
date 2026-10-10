export const STREAMING_PROVIDERS = ["netflix", "prime_video", "disney_plus", "canal_plus"] as const;

export type StreamingProvider = (typeof STREAMING_PROVIDERS)[number];

export type SyncReport = {
  moviesUpserted: number;
  providerLinks: Record<StreamingProvider, number>;
  linksRemoved: number;
  runtimesFilled: number;
  durationMs: number;
};
