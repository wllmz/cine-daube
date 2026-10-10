import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "../redirect";
import type { CurrentUser } from "../types";

/**
 * Data Access Layer entry point: every protected page and server action
 * goes through here. Redirects to the login page when signed out.
 * `getClaims` verifies the JWT signature, unlike `getSession` which trusts
 * the cookie as-is.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) redirect(SIGN_IN_PATH);

  const [profile] = await getDb()
    .select({ pseudo: profiles.pseudo })
    .from(profiles)
    .where(eq(profiles.id, data.claims.sub))
    .limit(1);
  if (!profile) redirect(SIGN_IN_PATH);

  return { id: data.claims.sub, email: data.claims.email ?? "", pseudo: profile.pseudo };
});
