// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

const U1 = "00000000-0000-0000-0000-000000000001";
const U2 = "00000000-0000-0000-0000-000000000002";
const OUTSIDER = "00000000-0000-0000-0000-000000000003";
const R1 = "10000000-0000-0000-0000-000000000001";
const R2 = "10000000-0000-0000-0000-000000000002";
const S1 = "20000000-0000-0000-0000-000000000001";

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();
  // Minimal stand-in for Supabase's auth schema and API roles.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  `);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${U1}', 'will@example.com', '{"pseudo": "Will"}'),
      ('${U2}', 'sarah@example.com', '{"pseudo": "Sarah"}'),
      ('${OUTSIDER}', 'intrus@example.com', '{"pseudo": "Intrus"}');
    insert into rooms (id, name, invite_code, invite_expires_at) values
      ('${R1}', 'Les Nanardeurs', 'AAA', now() + interval '7 days'),
      ('${R2}', 'Autre', 'BBB', now() + interval '7 days');
    insert into room_members (room_id, user_id, role) values
      ('${R1}', '${U1}', 'admin'), ('${R1}', '${U2}', 'member'), ('${R2}', '${OUTSIDER}', 'admin');
    insert into movies (tmdb_id, title, tmdb_rating, tmdb_vote_count) values
      (1, 'Film A', 3.1, 100), (2, 'Film B', 2.4, 80), (3, 'Film C', 4, 60);
    insert into spins (id, room_id, movie_id, launched_by) values ('${S1}', '${R1}', 1, '${U1}');
    insert into spin_votes (spin_id, room_id, user_id) values ('${S1}', '${R1}', '${U1}'), ('${S1}', '${R1}', '${U2}');
  `);
  return db;
}

async function count(db: PGlite, table: string, where: string): Promise<number> {
  const result = await db.query<{ n: number }>(
    `select count(*)::int as n from ${table} where ${where}`,
  );
  return result.rows[0]?.n ?? -1;
}

/** Resolves the seeded spin and marks its movie as watched by room R1. */
async function watchMovie(db: PGlite): Promise<void> {
  await db.exec(`
    update spins set status = 'accepted', resolved_at = now() where id = '${S1}';
    insert into room_movies (room_id, movie_id, status, spin_id) values ('${R1}', 1, 'watched', '${S1}');
    insert into room_movies (room_id, movie_id, status) values ('${R1}', 2, 'seen_before');
  `);
}

describe("database schema", () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await createDatabase();
  });

  describe("spins", () => {
    it("allows only one spin being voted on per room", async () => {
      await expect(
        db.exec(`insert into spins (room_id, movie_id) values ('${R1}', 2)`),
      ).rejects.toThrow(/spins_one_voting_per_room_idx/);
    });

    it("keeps status and resolved_at consistent", async () => {
      await expect(
        db.exec(`insert into spins (room_id, movie_id, status) values ('${R2}', 2, 'accepted')`),
      ).rejects.toThrow(/spins_resolved_when_not_voting/);
      await expect(
        db.exec(`insert into spins (room_id, movie_id, resolved_at) values ('${R2}', 2, now())`),
      ).rejects.toThrow(/spins_resolved_when_not_voting/);
    });
  });

  describe("spin votes", () => {
    it("rejects voters who are not members of the room", async () => {
      await expect(
        db.exec(`insert into spin_votes (spin_id, room_id, user_id) values ('${S1}', '${R1}', '${OUTSIDER}')`),
      ).rejects.toThrow(/spin_votes_member_fk/);
    });

    it("rejects a vote attached to another room than the spin's", async () => {
      await expect(
        db.exec(`insert into spin_votes (spin_id, room_id, user_id) values ('${S1}', '${R2}', '${OUTSIDER}')`),
      ).rejects.toThrow(/spin_votes_spin_fk/);
    });

    it("requires voted_at when a vote is cast", async () => {
      await expect(
        db.exec(`update spin_votes set vote = 'yes' where user_id = '${U1}'`),
      ).rejects.toThrow(/spin_votes_voted_at_set/);
      await db.exec(`update spin_votes set vote = 'yes', voted_at = now() where user_id = '${U1}'`);
      expect(await count(db, "spin_votes", "vote = 'yes'")).toBe(1);
    });
  });

  describe("room movies", () => {
    it("rejects a spin that is about another movie", async () => {
      await db.exec(`update spins set status = 'accepted', resolved_at = now() where id = '${S1}'`);
      await expect(
        db.exec(`insert into room_movies (room_id, movie_id, status, spin_id) values ('${R1}', 2, 'watched', '${S1}')`),
      ).rejects.toThrow(/room_movies_spin_fk/);
    });
  });

  describe("ratings", () => {
    beforeEach(async () => {
      await watchMovie(db);
    });

    it("accepts a member's rating with or without the acting bonus", async () => {
      await db.exec(`
        insert into ratings (room_id, movie_id, user_id, humour, scenario, acting) values ('${R1}', 1, '${U1}', 2, 1, 3);
        insert into ratings (room_id, movie_id, user_id, humour, scenario) values ('${R1}', 1, '${U2}', 3, 2);
      `);
      expect(await count(db, "ratings", `room_id = '${R1}'`)).toBe(2);
    });

    it("rejects ratings on a movie marked as already seen", async () => {
      await expect(
        db.exec(`insert into ratings (room_id, movie_id, user_id, humour, scenario) values ('${R1}', 2, '${U1}', 2, 2)`),
      ).rejects.toThrow(/ratings_room_movie_fk/);
      await expect(
        db.exec(`insert into ratings (room_id, movie_id, user_id, movie_status, humour, scenario) values ('${R1}', 2, '${U1}', 'seen_before', 2, 2)`),
      ).rejects.toThrow(/ratings_movie_watched/);
    });

    it("rejects ratings from non-members", async () => {
      await expect(
        db.exec(`insert into ratings (room_id, movie_id, user_id, humour, scenario) values ('${R1}', 1, '${OUTSIDER}', 2, 2)`),
      ).rejects.toThrow(/ratings_member_fk/);
    });

    it("rejects scores outside 0-10", async () => {
      await expect(
        db.exec(`insert into ratings (room_id, movie_id, user_id, humour, scenario) values ('${R1}', 1, '${U1}', 11, 2)`),
      ).rejects.toThrow(/ratings_humour_range/);
      await expect(
        db.exec(`insert into ratings (room_id, movie_id, user_id, humour, scenario, acting) values ('${R1}', 1, '${U1}', 2, 2, -1)`),
      ).rejects.toThrow(/ratings_acting_range/);
    });

    it("prevents removing a rated movie from the room", async () => {
      await db.exec(`insert into ratings (room_id, movie_id, user_id, humour, scenario) values ('${R1}', 1, '${U1}', 2, 1)`);
      await expect(
        db.exec(`delete from room_movies where room_id = '${R1}' and movie_id = 1`),
      ).rejects.toThrow(/ratings_room_movie_fk/);
    });
  });

  describe("deletions", () => {
    beforeEach(async () => {
      await watchMovie(db);
      await db.exec(`
        insert into ratings (room_id, movie_id, user_id, humour, scenario) values
          ('${R1}', 1, '${U1}', 2, 1), ('${R1}', 1, '${U2}', 3, 2);
      `);
    });

    it("keeps the room history when an account is deleted", async () => {
      await db.exec(`delete from auth.users where id = '${U1}'`);
      expect(await count(db, "rooms", `id = '${R1}'`)).toBe(1);
      expect(await count(db, "spins", `id = '${S1}' and launched_by is null`)).toBe(1);
      expect(await count(db, "room_movies", `room_id = '${R1}'`)).toBe(2);
      expect(await count(db, "ratings", `user_id = '${U1}'`)).toBe(0);
      expect(await count(db, "ratings", `user_id = '${U2}'`)).toBe(1);
    });

    it("removes everything belonging to a deleted room and nothing else", async () => {
      await db.exec(`delete from rooms where id = '${R1}'`);
      for (const table of ["room_members", "spins", "spin_votes", "room_movies", "ratings"]) {
        expect(await count(db, table, `room_id = '${R1}'`)).toBe(0);
      }
      expect(await count(db, "room_members", `room_id = '${R2}'`)).toBe(1);
    });
  });

  describe("profiles", () => {
    const NEW_USER = "30000000-0000-0000-0000-000000000001";

    async function pseudoOf(id: string): Promise<string | undefined> {
      const result = await db.query<{ pseudo: string }>(
        `select pseudo from profiles where id = '${id}'`,
      );
      return result.rows[0]?.pseudo;
    }

    it("creates the profile with the signup pseudo", async () => {
      expect(await pseudoOf(U1)).toBe("Will");
    });

    it("strips control characters and truncates to 30 characters", async () => {
      await db.exec(`
        insert into auth.users (id, email, raw_user_meta_data)
        values ('${NEW_USER}', 'x@example.com', '{"pseudo": "  Le\\tRoi\\n${"x".repeat(40)}  "}')
      `);
      expect(await pseudoOf(NEW_USER)).toBe(`LeRoi${"x".repeat(25)}`);
    });

    it.each([
      ["a blank pseudo", `'{"pseudo": " \\n "}'`],
      ["missing metadata", "null"],
    ])("falls back to Anonyme on %s, never on the email", async (_label, metadata) => {
      await db.exec(`
        insert into auth.users (id, email, raw_user_meta_data)
        values ('${NEW_USER}', 'secret.name@example.com', ${metadata})
      `);
      expect(await pseudoOf(NEW_USER)).toBe("Anonyme");
    });

    it("rejects an empty pseudo", async () => {
      await expect(
        db.exec(`update profiles set pseudo = '' where id = '${U1}'`),
      ).rejects.toThrow(/profiles_pseudo_length/);
    });
  });
});
