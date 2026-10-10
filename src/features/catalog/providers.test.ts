import { describe, expect, it } from "vitest";
import { resolveProviderIds } from "./providers";

const FR_PROVIDERS = [
  { provider_id: 8, provider_name: "Netflix" },
  { provider_id: 1796, provider_name: "Netflix Standard with Ads" },
  { provider_id: 119, provider_name: "Amazon Prime Video" },
  { provider_id: 337, provider_name: "Disney Plus" },
  { provider_id: 381, provider_name: "Canal+" },
  { provider_id: 2, provider_name: "Apple TV" },
];

describe("resolveProviderIds", () => {
  it("maps each platform to all its TMDB variants", () => {
    expect(resolveProviderIds(FR_PROVIDERS)).toEqual({
      netflix: [8, 1796],
      prime_video: [119],
      disney_plus: [337],
      canal_plus: [381],
    });
  });

  it("matches names regardless of case and spaces", () => {
    const providers = FR_PROVIDERS.map((p) => ({ ...p, provider_name: ` ${p.provider_name.toUpperCase()} ` }));
    expect(resolveProviderIds(providers).canal_plus).toEqual([381]);
  });

  it("fails loudly when a platform disappeared", () => {
    const withoutCanal = FR_PROVIDERS.filter((p) => p.provider_name !== "Canal+");
    expect(() => resolveProviderIds(withoutCanal)).toThrow(/canal_plus/);
  });
});
