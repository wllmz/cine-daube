import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCatalogEnv, type CatalogEnv } from "@/config/catalog-env";
import { getDb } from "@/db";
import { syncCatalog } from "@/features/catalog/services/sync-catalog";
import { createTmdbClient } from "@/features/catalog/tmdb-client";
import { SyncAlreadyRunningError } from "@/features/catalog/types";

// A full sync paginates 4 platforms and looks up runtimes.
export const maxDuration = 300;

/** Hashing first makes the comparison constant-time regardless of length. */
function isAuthorized(header: string | null, secret: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`));
}

function readCatalogEnv(): CatalogEnv | null {
  try {
    return getCatalogEnv();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** Daily catalog sync, called by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: NextRequest) {
  // Read the request first: with Cache Components, a GET handler that touches
  // no request data could be prerendered at build time.
  const authorization = request.headers.get("authorization");

  const env = readCatalogEnv();
  if (!env) {
    return Response.json({ error: "Unavailable" }, { status: 503 });
  }
  if (!isAuthorized(authorization, env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await syncCatalog(getDb(), createTmdbClient({ token: env.TMDB_API_TOKEN }));
    console.info("Catalog sync done", report);
    return Response.json(report);
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) {
      return Response.json({ error: "Already running" }, { status: 409 });
    }
    console.error("Catalog sync failed", error);
    return Response.json({ error: "Catalog sync failed" }, { status: 502 });
  }
}
