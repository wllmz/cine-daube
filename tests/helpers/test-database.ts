import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Database } from "@/db";
import * as schema from "@/db/schema";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

/** In-memory Postgres with Supabase's auth stand-in and every migration applied. */
export async function createTestPglite(): Promise<PGlite> {
  const pglite = new PGlite();
  await pglite.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  `);
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await pglite.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  return pglite;
}

export async function createTestDatabase(): Promise<{ db: Database; pglite: PGlite }> {
  const pglite = await createTestPglite();
  return { db: drizzle(pglite, { schema }), pglite };
}

/** Signs up a user the way Supabase does: the trigger creates the profile. */
export async function createUser(pglite: PGlite, pseudo: string): Promise<string> {
  const id = randomUUID();
  await pglite.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [
    id,
    JSON.stringify({ pseudo }),
  ]);
  return id;
}
