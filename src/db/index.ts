import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/config/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { db?: Database };

function createDb(): Database {
  const client = postgres(getServerEnv().DATABASE_URL, {
    // Supabase transaction pooler does not support prepared statements.
    prepare: false,
    // Serverless instances multiply: keep each pool small, the pooler does the rest.
    max: 3,
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
}

/** Reuses one connection pool per server instance (and across dev HMR reloads). */
export function getDb(): Database {
  if (!globalForDb.db) {
    globalForDb.db = createDb();
  }
  return globalForDb.db;
}
