import { sql } from "drizzle-orm";
import {
  boolean,
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
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// The app talks to Postgres through Drizzle (server only). RLS is enabled
// without policies on every table so the public Supabase key cannot read
// or write them through the REST API.
//
// Integrity rules that the vote and rating logic relies on are enforced here
// with composite foreign keys and checks, so a bug fails loudly instead of
// silently corrupting a room's history.

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
export const finishStatus = pgEnum("finish_status", ["voting", "accepted", "rejected"]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    pseudo: text("pseudo").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("profiles_pseudo_length", sql`char_length(${t.pseudo}) between 1 and 30`),
  ],
).enableRLS();

/** Ownership is modelled by `room_members.role = 'admin'`, so a room outlives its creator. */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    inviteCode: text("invite_code").notNull().unique(),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("rooms_name_length", sql`char_length(${t.name}) between 1 and 50`)],
).enableRLS();

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

export const movies = pgTable("movies", {
  tmdbId: integer("tmdb_id").primaryKey(),
  title: text("title").notNull(),
  releaseYear: smallint("release_year"),
  runtimeMinutes: smallint("runtime_minutes"),
  posterPath: text("poster_path"),
  overview: text("overview").notNull().default(""),
  tmdbRating: real("tmdb_rating").notNull(),
  tmdbVoteCount: integer("tmdb_vote_count").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

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
    // Kept nullable so a deleted account does not erase the room's history.
    launchedBy: uuid("launched_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
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
    // Targets for composite foreign keys below.
    unique("spins_id_room_unique").on(t.id, t.roomId),
    unique("spins_id_room_movie_unique").on(t.id, t.roomId, t.movieId),
    check(
      "spins_resolved_when_not_voting",
      sql`(${t.status} = 'voting') = (${t.resolvedAt} is null)`,
    ),
  ],
).enableRLS();

/**
 * One row per eligible voter, created when the spin starts (members online
 * at that moment). `vote` stays null until the member votes. Voters must be
 * members of the spin's room.
 */
export const spinVotes = pgTable(
  "spin_votes",
  {
    spinId: uuid("spin_id").notNull(),
    roomId: uuid("room_id").notNull(),
    userId: uuid("user_id").notNull(),
    vote: voteValue("vote"),
    votedAt: timestamp("voted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.spinId, t.userId] }),
    foreignKey({
      name: "spin_votes_spin_fk",
      columns: [t.spinId, t.roomId],
      foreignColumns: [spins.id, spins.roomId],
    }).onDelete("cascade"),
    foreignKey({
      name: "spin_votes_member_fk",
      columns: [t.roomId, t.userId],
      foreignColumns: [roomMembers.roomId, roomMembers.userId],
    }).onDelete("cascade"),
    index("spin_votes_member_idx").on(t.roomId, t.userId),
    check("spin_votes_voted_at_set", sql`(${t.vote} is null) = (${t.votedAt} is null)`),
  ],
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
    spinId: uuid("spin_id"),
    createdAt: createdAt(),
    // Set when the room votes the watched film finished: predictions close and are revealed.
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.movieId] }),
    // The spin, when set, must be about this room and this movie. Spins are
    // only deleted together with their room, so no delete action is needed.
    foreignKey({
      name: "room_movies_spin_fk",
      columns: [t.spinId, t.roomId, t.movieId],
      foreignColumns: [spins.id, spins.roomId, spins.movieId],
    }),
    index("room_movies_spin_idx").on(t.spinId),
    // Target for the ratings foreign key (only watched movies can be rated).
    unique("room_movies_room_movie_status_unique").on(t.roomId, t.movieId, t.status),
    check("room_movies_finished_when_watched", sql`${t.finishedAt} is null or ${t.status} = 'watched'`),
  ],
).enableRLS();

/** A member's rating of a movie the room watched. Leaving the room removes it. */
export const ratings = pgTable(
  "ratings",
  {
    roomId: uuid("room_id").notNull(),
    movieId: integer("movie_id").notNull(),
    userId: uuid("user_id").notNull(),
    // Always 'watched': lets the foreign key reject movies marked "déjà vu".
    movieStatus: roomMovieStatus("movie_status").notNull().default("watched"),
    humour: smallint("humour").notNull(),
    scenario: smallint("scenario").notNull(),
    // Optional bonus, excluded from the average.
    acting: smallint("acting"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.roomId, t.movieId, t.userId] }),
    foreignKey({
      name: "ratings_room_movie_fk",
      columns: [t.roomId, t.movieId, t.movieStatus],
      foreignColumns: [roomMovies.roomId, roomMovies.movieId, roomMovies.status],
      // "no action" (checked at end of statement): un-marking a rated movie fails,
      // while deleting the whole room still cascades cleanly.
    }).onDelete("no action"),
    foreignKey({
      name: "ratings_member_fk",
      columns: [t.roomId, t.userId],
      foreignColumns: [roomMembers.roomId, roomMembers.userId],
    }).onDelete("cascade"),
    index("ratings_member_idx").on(t.roomId, t.userId),
    check("ratings_movie_watched", sql`${t.movieStatus} = 'watched'`),
    check("ratings_humour_range", sql`${t.humour} between 0 and 10`),
    check("ratings_scenario_range", sql`${t.scenario} between 0 and 10`),
    check(
      "ratings_acting_range",
      sql`${t.acting} is null or ${t.acting} between 0 and 10`,
    ),
  ],
).enableRLS();

/** A member's guess about a film the room is watching (actors, scenes…), hidden until the film is finished. */
export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull(),
    movieId: integer("movie_id").notNull(),
    userId: uuid("user_id").notNull(),
    // Always 'watched': lets the foreign key reject movies marked "déjà vu".
    movieStatus: roomMovieStatus("movie_status").notNull().default("watched"),
    content: text("content").notNull(),
    createdAt: createdAt(),
    // The room's verdict once the film is over: true = 1 point. Null while it is judged.
    validated: boolean("validated"),
    judgedAt: timestamp("judged_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "predictions_room_movie_fk",
      columns: [t.roomId, t.movieId, t.movieStatus],
      foreignColumns: [roomMovies.roomId, roomMovies.movieId, roomMovies.status],
    }).onDelete("no action"),
    foreignKey({
      name: "predictions_member_fk",
      columns: [t.roomId, t.userId],
      foreignColumns: [roomMembers.roomId, roomMembers.userId],
    }).onDelete("cascade"),
    index("predictions_room_movie_idx").on(t.roomId, t.movieId),
    index("predictions_member_idx").on(t.roomId, t.userId),
    check("predictions_movie_watched", sql`${t.movieStatus} = 'watched'`),
    check("predictions_content_length", sql`char_length(${t.content}) between 1 and 140`),
    check("predictions_judged_at_set", sql`(${t.validated} is null) = (${t.judgedAt} is null)`),
    // Target for the prediction votes' foreign key.
    unique("predictions_id_room_unique").on(t.id, t.roomId),
  ],
).enableRLS();

/** "Film terminé ?" vote on a film the room is watching. */
export const finishProposals = pgTable(
  "finish_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull(),
    movieId: integer("movie_id").notNull(),
    proposedBy: uuid("proposed_by").references(() => profiles.id, { onDelete: "set null" }),
    status: finishStatus("status").notNull().default("voting"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: "finish_proposals_room_movie_fk",
      columns: [t.roomId, t.movieId],
      foreignColumns: [roomMovies.roomId, roomMovies.movieId],
    }).onDelete("cascade"),
    // At most one vote in progress per film.
    uniqueIndex("finish_proposals_one_voting_idx")
      .on(t.roomId, t.movieId)
      .where(sql`${t.status} = 'voting'`),
    unique("finish_proposals_id_room_unique").on(t.id, t.roomId),
    check(
      "finish_proposals_resolved_when_not_voting",
      sql`(${t.status} = 'voting') = (${t.resolvedAt} is null)`,
    ),
  ],
).enableRLS();

/** One row per voter (the film's roulette voters), created with the proposal. */
export const finishVotes = pgTable(
  "finish_votes",
  {
    proposalId: uuid("proposal_id").notNull(),
    roomId: uuid("room_id").notNull(),
    userId: uuid("user_id").notNull(),
    vote: voteValue("vote"),
    votedAt: timestamp("voted_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.proposalId, t.userId] }),
    foreignKey({
      name: "finish_votes_proposal_fk",
      columns: [t.proposalId, t.roomId],
      foreignColumns: [finishProposals.id, finishProposals.roomId],
    }).onDelete("cascade"),
    foreignKey({
      name: "finish_votes_member_fk",
      columns: [t.roomId, t.userId],
      foreignColumns: [roomMembers.roomId, roomMembers.userId],
    }).onDelete("cascade"),
    index("finish_votes_member_idx").on(t.roomId, t.userId),
    check("finish_votes_voted_at_set", sql`(${t.vote} is null) = (${t.votedAt} is null)`),
  ],
).enableRLS();

/** A member's verdict on someone else's prediction, once the film is finished. */
export const predictionVotes = pgTable(
  "prediction_votes",
  {
    predictionId: uuid("prediction_id").notNull(),
    roomId: uuid("room_id").notNull(),
    userId: uuid("user_id").notNull(),
    vote: voteValue("vote").notNull(),
    votedAt: timestamp("voted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.predictionId, t.userId] }),
    foreignKey({
      name: "prediction_votes_prediction_fk",
      columns: [t.predictionId, t.roomId],
      foreignColumns: [predictions.id, predictions.roomId],
    }).onDelete("cascade"),
    foreignKey({
      name: "prediction_votes_member_fk",
      columns: [t.roomId, t.userId],
      foreignColumns: [roomMembers.roomId, roomMembers.userId],
    }).onDelete("cascade"),
    index("prediction_votes_member_idx").on(t.roomId, t.userId),
  ],
).enableRLS();
