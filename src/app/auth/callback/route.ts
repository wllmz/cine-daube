import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/features/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing page of Supabase email links (signup confirmation, password reset):
 * exchanges the one-time code for a session, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
