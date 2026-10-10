CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."room_movie_status" AS ENUM('watched', 'seen_before');--> statement-breakpoint
CREATE TYPE "public"."spin_status" AS ENUM('voting', 'accepted', 'rejected', 'seen');--> statement-breakpoint
CREATE TYPE "public"."streaming_provider" AS ENUM('netflix', 'prime_video', 'disney_plus', 'canal_plus');--> statement-breakpoint
CREATE TYPE "public"."vote_value" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TABLE "movie_providers" (
	"movie_id" integer NOT NULL,
	"provider" "streaming_provider" NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_providers_movie_id_provider_pk" PRIMARY KEY("movie_id","provider")
);
--> statement-breakpoint
ALTER TABLE "movie_providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movies" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"release_year" smallint,
	"runtime_minutes" smallint,
	"poster_path" text,
	"overview" text DEFAULT '' NOT NULL,
	"tmdb_rating" real NOT NULL,
	"tmdb_vote_count" integer NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pseudo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_pseudo_length" CHECK (char_length("profiles"."pseudo") between 1 and 30)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ratings" (
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_status" "room_movie_status" DEFAULT 'watched' NOT NULL,
	"humour" smallint NOT NULL,
	"scenario" smallint NOT NULL,
	"acting" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_room_id_movie_id_user_id_pk" PRIMARY KEY("room_id","movie_id","user_id"),
	CONSTRAINT "ratings_movie_watched" CHECK ("ratings"."movie_status" = 'watched'),
	CONSTRAINT "ratings_humour_range" CHECK ("ratings"."humour" between 0 and 10),
	CONSTRAINT "ratings_scenario_range" CHECK ("ratings"."scenario" between 0 and 10),
	CONSTRAINT "ratings_acting_range" CHECK ("ratings"."acting" is null or "ratings"."acting" between 0 and 10)
);
--> statement-breakpoint
ALTER TABLE "ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "room_members" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "room_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "room_movies" (
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"status" "room_movie_status" NOT NULL,
	"spin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_movies_room_id_movie_id_pk" PRIMARY KEY("room_id","movie_id"),
	CONSTRAINT "room_movies_room_movie_status_unique" UNIQUE("room_id","movie_id","status")
);
--> statement-breakpoint
ALTER TABLE "room_movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"invite_code" text NOT NULL,
	"invite_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "rooms_name_length" CHECK (char_length("rooms"."name") between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "rooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spin_votes" (
	"spin_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote" "vote_value",
	"voted_at" timestamp with time zone,
	CONSTRAINT "spin_votes_spin_id_user_id_pk" PRIMARY KEY("spin_id","user_id"),
	CONSTRAINT "spin_votes_voted_at_set" CHECK (("spin_votes"."vote" is null) = ("spin_votes"."voted_at" is null))
);
--> statement-breakpoint
ALTER TABLE "spin_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"launched_by" uuid,
	"status" "spin_status" DEFAULT 'voting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "spins_id_room_unique" UNIQUE("id","room_id"),
	CONSTRAINT "spins_id_room_movie_unique" UNIQUE("id","room_id","movie_id"),
	CONSTRAINT "spins_resolved_when_not_voting" CHECK (("spins"."status" = 'voting') = ("spins"."resolved_at" is null))
);
--> statement-breakpoint
ALTER TABLE "spins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "movie_providers" ADD CONSTRAINT "movie_providers_movie_id_movies_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("tmdb_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_room_movie_fk" FOREIGN KEY ("room_id","movie_id","movie_status") REFERENCES "public"."room_movies"("room_id","movie_id","status") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_member_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."room_members"("room_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_movies" ADD CONSTRAINT "room_movies_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_movies" ADD CONSTRAINT "room_movies_movie_id_movies_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("tmdb_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_movies" ADD CONSTRAINT "room_movies_spin_fk" FOREIGN KEY ("spin_id","room_id","movie_id") REFERENCES "public"."spins"("id","room_id","movie_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_votes" ADD CONSTRAINT "spin_votes_spin_fk" FOREIGN KEY ("spin_id","room_id") REFERENCES "public"."spins"("id","room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spin_votes" ADD CONSTRAINT "spin_votes_member_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."room_members"("room_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spins" ADD CONSTRAINT "spins_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spins" ADD CONSTRAINT "spins_movie_id_movies_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("tmdb_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spins" ADD CONSTRAINT "spins_launched_by_profiles_id_fk" FOREIGN KEY ("launched_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movie_providers_provider_idx" ON "movie_providers" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ratings_member_idx" ON "ratings" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "room_members_user_idx" ON "room_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_movies_spin_idx" ON "room_movies" USING btree ("spin_id");--> statement-breakpoint
CREATE INDEX "spin_votes_member_idx" ON "spin_votes" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "spins_one_voting_per_room_idx" ON "spins" USING btree ("room_id") WHERE "spins"."status" = 'voting';--> statement-breakpoint
CREATE INDEX "spins_room_created_idx" ON "spins" USING btree ("room_id","created_at");