// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
type CookieMethods = {
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void;
};

const session = {
  signedIn: false,
  /** Cookies Supabase writes while refreshing, as during a real token rotation. */
  refreshedCookies: [] as CookieToSet[],
};

vi.mock("@/config/public-env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieMethods }) => ({
    auth: {
      getClaims: async () => {
        if (session.refreshedCookies.length > 0) {
          options.cookies.setAll(session.refreshedCookies, {
            "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
          });
        }
        return { data: session.signedIn ? { claims: { sub: "user-1" } } : null };
      },
    },
  }),
}));

const { updateSession } = await import("./proxy");

function request(path: string, method = "GET"): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), { method });
}

beforeEach(() => {
  session.signedIn = false;
  session.refreshedCookies = [];
});

describe("updateSession", () => {
  it("sends signed-out visitors to login with the requested path", async () => {
    const response = await updateSession(request("/rooms/abc?tab=films"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Frooms%2Fabc%3Ftab%3Dfilms",
    );
  });

  it("routes / depending on the session", async () => {
    expect((await updateSession(request("/"))).headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
    session.signedIn = true;
    expect((await updateSession(request("/"))).headers.get("location")).toBe(
      "http://localhost:3000/rooms",
    );
  });

  it("keeps guests on public pages and signed-in users away from them", async () => {
    expect((await updateSession(request("/signup"))).headers.get("location")).toBeNull();
    expect((await updateSession(request("/auth/confirm"))).headers.get("location")).toBeNull();
    session.signedIn = true;
    expect((await updateSession(request("/login"))).headers.get("location")).toBe(
      "http://localhost:3000/rooms",
    );
  });

  it("keeps every refreshed cookie and the no-cache headers on a redirect", async () => {
    session.signedIn = true;
    session.refreshedCookies = [
      { name: "sb-x-auth-token.0", value: "part-0", options: { path: "/" } },
      { name: "sb-x-auth-token.1", value: "part-1", options: { path: "/" } },
      { name: "sb-x-auth-token-code-verifier", value: "", options: { path: "/", maxAge: 0 } },
    ];

    const response = await updateSession(request("/"));

    expect(response.status).toBe(307);
    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(3);
    expect(setCookies.join("\n")).toContain("sb-x-auth-token.0=part-0");
    expect(setCookies.join("\n")).toContain("sb-x-auth-token.1=part-1");
    expect(response.headers.get("cache-control")).toContain("no-store");
    // Headers of the NextResponse.next() response (which carry the request
    // cookies, tokens included) must not be copied onto the redirect.
    // x-middleware-set-cookie is added by Next itself for any cookie set.
    const leaked = [...response.headers.keys()].filter(
      (key) =>
        key === "x-middleware-next" ||
        key === "x-middleware-override-headers" ||
        key.startsWith("x-middleware-request-"),
    );
    expect(leaked).toEqual([]);
  });

  it("lets server action POSTs through even when signed out", async () => {
    const response = await updateSession(request("/rooms", "POST"));
    expect(response.headers.get("location")).toBeNull();
  });
});
