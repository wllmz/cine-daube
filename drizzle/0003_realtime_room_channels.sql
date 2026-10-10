-- Private Supabase Realtime channels per room, topic "room:<room id>".
-- Only members of the room can join (receive broadcasts and presence) and
-- track their presence. The app never sends broadcasts itself: the database
-- does, from triggers, once a change is committed.

-- Membership check usable from realtime policies (which run as the user).
-- SECURITY DEFINER because room_members has RLS with no policies.
CREATE OR REPLACE FUNCTION public.is_room_member(topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.room_members AS m
    WHERE m.user_id = auth.uid()
      AND topic = 'room:' || m.room_id::text
  );
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_room_member(text) FROM PUBLIC, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_room_member(text) TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "room members receive room events" ON realtime.messages;
--> statement-breakpoint
CREATE POLICY "room members receive room events"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.is_room_member(realtime.topic())
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "room members share presence" ON realtime.messages;
--> statement-breakpoint
-- Clients may only track presence; broadcasts come from the database.
CREATE POLICY "room members share presence"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.messages.extension = 'presence'
    AND public.is_room_member(realtime.topic())
  );
--> statement-breakpoint
-- Tells the room something changed; clients re-read through the app (the
-- payload carries no data, so nothing leaks through the channel).
CREATE OR REPLACE FUNCTION public.notify_room_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_room uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_room := old.room_id;
  ELSE
    target_room := new.room_id;
  END IF;
  PERFORM realtime.send(
    jsonb_build_object('table', TG_TABLE_NAME),
    'room_changed',
    'room:' || target_room::text,
    true
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.notify_room_change() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
DROP TRIGGER IF EXISTS spins_notify_room ON public.spins;
--> statement-breakpoint
CREATE TRIGGER spins_notify_room
  AFTER INSERT OR UPDATE ON public.spins
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS spin_votes_notify_room ON public.spin_votes;
--> statement-breakpoint
CREATE TRIGGER spin_votes_notify_room
  AFTER UPDATE ON public.spin_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
--> statement-breakpoint
DROP TRIGGER IF EXISTS room_members_notify_room ON public.room_members;
--> statement-breakpoint
CREATE TRIGGER room_members_notify_room
  AFTER INSERT OR DELETE ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_room_change();
