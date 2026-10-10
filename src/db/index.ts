import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/config/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { db?: Database };

function createDb(): Database {
  // Supabase transaction pooler does not support prepared statements.
  const client = postgres(getServerEnv().DATABASE_URL, { prepare: false });
  return drizzle(client, { schema });
}

/** Reuses one connection pool per server instance (and across dev HMR reloads). */
export function getDb(): Database {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}
