import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AFTER_SIGN_IN_PATH } from "@/features/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DESTINATIONS = {
  email: AFTER_SIGN_IN_PATH,
  recovery: "/reset-password",
} as const;

const linkSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["email", "recovery"]),
});

/**
 * Landing page of Supabase email links (signup confirmation, password reset).
 * Uses the token_hash flow: no cookie from the requesting browser is needed,
 * so a link opened on another device works. The destination depends only on
 * the link type, never on user input.
 */
export async function GET(request: NextRequest) {
  const link = linkSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (link.success) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: link.data.type,
      token_hash: link.data.token_hash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(DESTINATIONS[link.data.type], request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
