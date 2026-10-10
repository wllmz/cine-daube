import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getCatalogEnv } from "@/config/catalog-env";
import { getDb } from "@/db";
import { syncCatalog } from "@/features/catalog/services/sync-catalog";
import { createTmdbClient } from "@/features/catalog/tmdb-client";

// A full sync paginates 4 platforms and looks up runtimes.
export const maxDuration = 300;

function isAuthorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Daily catalog sync, called by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: NextRequest) {
  let env;
  try {
    env = getCatalogEnv();
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Catalog sync is not configured" }, { status: 500 });
  }

  if (!isAuthorized(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await syncCatalog(getDb(), createTmdbClient({ token: env.TMDB_API_TOKEN }));
    console.info("Catalog sync done", report);
    return Response.json(report);
  } catch (error) {
    console.error("Catalog sync failed", error);
    return Response.json({ error: "Catalog sync failed" }, { status: 502 });
  }
}
