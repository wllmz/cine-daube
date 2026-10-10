// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "cron-secret-0123456789";
const env = { ok: true };
const syncCatalog = vi.fn();

vi.mock("@/config/catalog-env", () => ({
  getCatalogEnv: () => {
    if (!env.ok) throw new Error("TMDB_API_TOKEN missing");
    return { TMDB_API_TOKEN: "tmdb-token-0123456789", CRON_SECRET: SECRET };
  },
}));
vi.mock("@/db", () => ({ getDb: () => "db" }));
vi.mock("@/features/catalog/services/sync-catalog", () => ({ syncCatalog }));

const { GET } = await import("./route");

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost:3000/api/cron/sync-catalog", { headers }));
}

beforeEach(() => {
  env.ok = true;
  syncCatalog.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("GET /api/cron/sync-catalog", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer nope"],
    ["the secret without Bearer", SECRET],
  ])("rejects %s without syncing", async (_label, header) => {
    const response = await call(header);
    expect(response.status).toBe(401);
    expect(syncCatalog).not.toHaveBeenCalled();
  });

  it("runs the sync and returns its report", async () => {
    syncCatalog.mockResolvedValue({ moviesUpserted: 12 });
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ moviesUpserted: 12 });
    expect(syncCatalog.mock.calls[0]?.[0]).toBe("db");
  });

  it("reports a failed sync without leaking details", async () => {
    syncCatalog.mockRejectedValue(new Error("TMDB responded 401 with token xyz"));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Catalog sync failed" });
  });

  it("is unavailable when the catalog is not configured", async () => {
    env.ok = false;
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(syncCatalog).not.toHaveBeenCalled();
  });

  it("tells a concurrent run apart from a failure", async () => {
    const { SyncAlreadyRunningError } = await import("@/features/catalog/types");
    syncCatalog.mockRejectedValue(new SyncAlreadyRunningError());
    expect((await call(`Bearer ${SECRET}`)).status).toBe(409);
  });
});
