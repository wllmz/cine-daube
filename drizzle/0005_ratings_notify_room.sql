-- Ratings change the room's averages: tell the room, like spins and votes.
DROP TRIGGER IF EXISTS ratings_notify_room ON public.ratings;
--> statement-breakpoint
CREATE TRIGGER ratings_notify_room
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
