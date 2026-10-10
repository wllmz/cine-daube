import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/config/public-env";

const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
const PUBLIC_PATHS = [...GUEST_ONLY_PATHS, "/auth/callback"];

/**
 * Refreshes the Supabase session on every request and does optimistic
 * routing. Real authorization still happens in the Data Access Layer.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          cacheHeaders = { ...cacheHeaders, ...headers };
          Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  /**
   * Redirect that carries every refreshed session cookie (one Set-Cookie
   * each) and the no-cache headers, and nothing else from `response`.
   */
  function redirectTo(path: string, searchParams?: Record<string, string>): NextResponse {
    const url = new URL(path, request.url);
    Object.entries(searchParams ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(cacheHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  }

  // Do not run code between createServerClient and getClaims: it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  // Server action POSTs must reach Next: a 307 would break them client-side.
  // The Data Access Layer redirects them if the session is gone.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return response;
  }

  if (pathname === "/") {
    return redirectTo(isSignedIn ? "/rooms" : "/login");
  }

  if (!isSignedIn && !PUBLIC_PATHS.includes(pathname)) {
    return redirectTo("/login", { next: `${pathname}${search}` });
  }

  if (isSignedIn && GUEST_ONLY_PATHS.includes(pathname)) {
    return redirectTo("/rooms");
  }

  return response;
}
