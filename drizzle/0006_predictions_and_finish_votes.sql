CREATE TYPE "public"."finish_status" AS ENUM('voting', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "finish_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"proposed_by" uuid,
	"status" "finish_status" DEFAULT 'voting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "finish_proposals_id_room_unique" UNIQUE("id","room_id"),
	CONSTRAINT "finish_proposals_resolved_when_not_voting" CHECK (("finish_proposals"."status" = 'voting') = ("finish_proposals"."resolved_at" is null))
);
--> statement-breakpoint
ALTER TABLE "finish_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finish_votes" (
	"proposal_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote" "vote_value",
	"voted_at" timestamp with time zone,
	CONSTRAINT "finish_votes_proposal_id_user_id_pk" PRIMARY KEY("proposal_id","user_id"),
	CONSTRAINT "finish_votes_voted_at_set" CHECK (("finish_votes"."vote" is null) = ("finish_votes"."voted_at" is null))
);
--> statement-breakpoint
ALTER TABLE "finish_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"movie_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_status" "room_movie_status" DEFAULT 'watched' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predictions_movie_watched" CHECK ("predictions"."movie_status" = 'watched'),
	CONSTRAINT "predictions_content_length" CHECK (char_length("predictions"."content") between 1 and 140)
);
--> statement-breakpoint
ALTER TABLE "predictions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room_movies" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "finish_proposals" ADD CONSTRAINT "finish_proposals_proposed_by_profiles_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_proposals" ADD CONSTRAINT "finish_proposals_room_movie_fk" FOREIGN KEY ("room_id","movie_id") REFERENCES "public"."room_movies"("room_id","movie_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_votes" ADD CONSTRAINT "finish_votes_proposal_fk" FOREIGN KEY ("proposal_id","room_id") REFERENCES "public"."finish_proposals"("id","room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finish_votes" ADD CONSTRAINT "finish_votes_member_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."room_members"("room_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_room_movie_fk" FOREIGN KEY ("room_id","movie_id","movie_status") REFERENCES "public"."room_movies"("room_id","movie_id","status") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_member_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."room_members"("room_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finish_proposals_one_voting_idx" ON "finish_proposals" USING btree ("room_id","movie_id") WHERE "finish_proposals"."status" = 'voting';--> statement-breakpoint
CREATE INDEX "finish_votes_member_idx" ON "finish_votes" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "predictions_room_movie_idx" ON "predictions" USING btree ("room_id","movie_id");--> statement-breakpoint
CREATE INDEX "predictions_member_idx" ON "predictions" USING btree ("room_id","user_id");--> statement-breakpoint
ALTER TABLE "room_movies" ADD CONSTRAINT "room_movies_finished_when_watched" CHECK ("room_movies"."finished_at" is null or "room_movies"."status" = 'watched');--> statement-breakpoint
-- Films watched before predictions existed are over: nothing to predict on them.
UPDATE "room_movies" SET "finished_at" = "created_at" WHERE "status" = 'watched' AND "finished_at" IS NULL;
--> statement-breakpoint
-- Tell the room about predictions and "Film terminé ?" votes, like spins and votes.
DROP TRIGGER IF EXISTS predictions_notify_room ON public.predictions;
--> statement-breakpoint
CREATE TRIGGER predictions_notify_room
  AFTER INSERT OR DELETE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS finish_proposals_notify_room ON public.finish_proposals;
--> statement-breakpoint
CREATE TRIGGER finish_proposals_notify_room
  AFTER INSERT OR UPDATE ON public.finish_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS finish_votes_notify_room ON public.finish_votes;
--> statement-breakpoint
CREATE TRIGGER finish_votes_notify_room
  AFTER UPDATE ON public.finish_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
