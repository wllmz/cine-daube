import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/config/public-env";

const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
const PUBLIC_PATHS = [...GUEST_ONLY_PATHS, "/auth/callback"];

/** Redirect that keeps the refreshed session cookies and no-cache headers. */
function redirectKeepingSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "location") redirect.headers.set(key, value);
  });
  return redirect;
}

/**
 * Refreshes the Supabase session on every request and does optimistic
 * routing. Real authorization still happens in the Data Access Layer.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    return redirectKeepingSession(new URL(isSignedIn ? "/rooms" : "/login", request.url), response);
  }

  if (!isSignedIn && !PUBLIC_PATHS.includes(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingSession(loginUrl, response);
  }

  if (isSignedIn && GUEST_ONLY_PATHS.includes(pathname)) {
    return redirectKeepingSession(new URL("/rooms", request.url), response);
  }

  return response;
}
