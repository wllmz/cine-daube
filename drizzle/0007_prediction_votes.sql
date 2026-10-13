CREATE TABLE "prediction_votes" (
	"prediction_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote" "vote_value" NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_votes_prediction_id_user_id_pk" PRIMARY KEY("prediction_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "prediction_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "validated" boolean;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "judged_at" timestamp with time zone;--> statement-breakpoint
-- The unique target must exist before the foreign key that references it.
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_id_room_unique" UNIQUE("id","room_id");--> statement-breakpoint
ALTER TABLE "prediction_votes" ADD CONSTRAINT "prediction_votes_prediction_fk" FOREIGN KEY ("prediction_id","room_id") REFERENCES "public"."predictions"("id","room_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_votes" ADD CONSTRAINT "prediction_votes_member_fk" FOREIGN KEY ("room_id","user_id") REFERENCES "public"."room_members"("room_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prediction_votes_member_idx" ON "prediction_votes" USING btree ("room_id","user_id");--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_judged_at_set" CHECK (("predictions"."validated" is null) = ("predictions"."judged_at" is null));--> statement-breakpoint
-- Predictions made before judging existed were never voted on: they are closed
-- without a point (decided with the room's admin), instead of being judged by accident.
UPDATE "predictions" SET "validated" = false, "judged_at" = now()
WHERE "validated" IS NULL
  AND EXISTS (
    SELECT 1 FROM "room_movies" AS rm
    WHERE rm."room_id" = "predictions"."room_id"
      AND rm."movie_id" = "predictions"."movie_id"
      AND rm."finished_at" IS NOT NULL
  );
--> statement-breakpoint
-- Votes and verdicts change the film's results: tell the room.
DROP TRIGGER IF EXISTS prediction_votes_notify_room ON public.prediction_votes;
--> statement-breakpoint
CREATE TRIGGER prediction_votes_notify_room
  AFTER INSERT OR UPDATE ON public.prediction_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS predictions_notify_room ON public.predictions;
--> statement-breakpoint
CREATE TRIGGER predictions_notify_room
  AFTER INSERT OR UPDATE OR DELETE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
