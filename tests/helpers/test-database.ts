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
    -- auth.uid() reads the JWT subject, set per test with set_config.
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    -- Minimal stand-in for Supabase Realtime: messages (for policies),
    -- topic() and send(), which records what would be broadcast.
    create schema realtime;
    create table realtime.messages (
      id uuid primary key default gen_random_uuid(),
      topic text not null, extension text not null, payload jsonb, event text, private boolean
    );
    alter table realtime.messages enable row level security;
    create table realtime.sent (topic text, event text, payload jsonb, private boolean);
    create function realtime.topic() returns text language sql stable as $$
      select current_setting('realtime.topic', true)
    $$;
    create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
    returns void language sql as $$
      insert into realtime.sent (topic, event, payload, private) values (topic, event, payload, private)
    $$;
    grant usage on schema realtime, auth to authenticated;
    grant select, insert on realtime.messages to authenticated;
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
