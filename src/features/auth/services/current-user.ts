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
 * Data Access Layer entry point for app data: protected pages and server
 * actions resolve the user here. Redirects to the login page when signed out.
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
  // The signup trigger guarantees a profile. Redirecting to /login here would
  // loop (the proxy sends signed-in users back), so fail loudly instead.
  if (!profile) {
    throw new Error(`No profile for authenticated user ${data.claims.sub}`);
  }

  return { id: data.claims.sub, email: data.claims.email ?? "", pseudo: profile.pseudo };
});
