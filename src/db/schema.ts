import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// The app talks to Postgres through Drizzle (server only). RLS is enabled
// without policies on every table so the public Supabase key cannot read
// or write them through the REST API.

export const memberRole = pgEnum("member_role", ["admin", "member"]);
export const streamingProvider = pgEnum("streaming_provider", [
  "netflix",
  "prime_video",
  "disney_plus",
  "canal_plus",
]);
export const spinStatus = pgEnum("spin_status", [
  "voting",
  "accepted",
  "rejected",
  "seen",
]);
export const voteValue = pgEnum("vote_value", ["yes", "no"]);
export const roomMovieStatus = pgEnum("room_movie_status", [
  "watched",
  "seen_before",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  pseudo: text("pseudo").notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull().unique(),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.userId] }),
    index("room_members_user_idx").on(t.userId),
  ],
).enableRLS();

export const movies = pgTable(
  "movies",
  {
    tmdbId: integer("tmdb_id").primaryKey(),
    title: text("title").notNull(),
    releaseYear: smallint("release_year"),
    runtimeMinutes: smallint("runtime_minutes"),
    posterPath: text("poster_path"),
    overview: text("overview").notNull().default(""),
    tmdbRating: real("tmdb_rating").notNull(),
    tmdbVoteCount: integer("tmdb_vote_count").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
).enableRLS();

export const movieProviders = pgTable(
  "movie_providers",
  {
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.tmdbId, { onDelete: "cascade" }),
    provider: streamingProvider("provider").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.movieId, t.provider] }),
    index("movie_providers_provider_idx").on(t.provider),
  ],
).enableRLS();

export const spins = pgTable(
  "spins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.tmdbId),
    launchedBy: uuid("launched_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: spinStatus("status").notNull().default("voting"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    // At most one spin being voted on per room.
    uniqueIndex("spins_one_voting_per_room_idx")
      .on(t.roomId)
      .where(sql`${t.status} = 'voting'`),
    index("spins_room_created_idx").on(t.roomId, t.createdAt),
  ],
).enableRLS();

/**
 * One row per eligible voter, created when the spin starts (members online
 * at that moment). `vote` stays null until the member votes.
 */
export const spinVotes = pgTable(
  "spin_votes",
  {
    spinId: uuid("spin_id")
      .notNull()
      .references(() => spins.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    vote: voteValue("vote"),
    votedAt: timestamp("voted_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.spinId, t.userId] })],
).enableRLS();

/** Movies removed from a room's roulette pool: watched together or already seen. */
export const roomMovies = pgTable(
  "room_movies",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.tmdbId),
    status: roomMovieStatus("status").notNull(),
    spinId: uuid("spin_id").references(() => spins.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.movieId] })],
).enableRLS();

export const ratings = pgTable(
  "ratings",
  {
    roomId: uuid("room_id").notNull(),
    movieId: integer("movie_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    humour: smallint("humour").notNull(),
    scenario: smallint("scenario").notNull(),
    // Optional bonus, excluded from the average.
    acting: smallint("acting"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.movieId, t.userId] }),
    foreignKey({
      columns: [t.roomId, t.movieId],
      foreignColumns: [roomMovies.roomId, roomMovies.movieId],
    }).onDelete("cascade"),
    check("ratings_humour_range", sql`${t.humour} between 0 and 10`),
    check("ratings_scenario_range", sql`${t.scenario} between 0 and 10`),
    check(
      "ratings_acting_range",
      sql`${t.acting} is null or ${t.acting} between 0 and 10`,
    ),
  ],
).enableRLS();
