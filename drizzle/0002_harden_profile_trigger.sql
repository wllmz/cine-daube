-- The publishable key allows calling signUp directly, bypassing the app's
-- Zod validation, so the trigger sanitises the pseudo itself:
-- control characters are removed, blanks fall back to 'Anonyme' (the email
-- local part is no longer used: it would expose part of the address).
CREATE OR REPLACE FUNCTION public.profile_pseudo_from_metadata(metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT left(
    coalesce(
      nullif(btrim(regexp_replace(metadata ->> 'pseudo', '[[:cntrl:]]', '', 'g')), ''),
      'Anonyme'
    ),
    30
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, pseudo)
  VALUES (new.id, public.profile_pseudo_from_metadata(new.raw_user_meta_data));
  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.profile_pseudo_from_metadata(jsonb) FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
-- Accounts created before the trigger existed get a profile too.
INSERT INTO public.profiles (id, pseudo)
SELECT u.id, public.profile_pseudo_from_metadata(u.raw_user_meta_data)
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;
