-- Creates the profile row as soon as Supabase Auth creates the user, in the
-- same transaction, using the pseudo passed in signUp options.data.
-- Falls back to the email local part so a signup can never fail here.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo)
  VALUES (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'pseudo'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Anonyme'
      ),
      30
    )
  );
  RETURN new;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint
-- Only the trigger may run it, never a client through the REST API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
