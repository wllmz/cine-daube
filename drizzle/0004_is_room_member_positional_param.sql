-- In a LANGUAGE sql function, a column name wins over a parameter name: if
-- room_members ever got a "topic" column, the check would silently compare
-- the column. Refer to the parameter by position instead.
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
      AND $1 = 'room:' || m.room_id::text
  );
$$;
