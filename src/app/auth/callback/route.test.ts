// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

const { GET } = await import("./route");

function callback(query: string) {
  return GET(new NextRequest(new URL(`/auth/callback${query}`, "http://localhost:3000")));
}

beforeEach(() => {
  exchangeCodeForSession.mockReset();
});

describe("GET /auth/callback", () => {
  it("opens a session and continues to `next`", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await callback("?code=abc&next=%2Freset-password");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  });

  it("defaults to the rooms", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await callback("?code=abc");
    expect(response.headers.get("location")).toBe("http://localhost:3000/rooms");
  });

  it.each([["an external URL", "https%3A%2F%2Fevil.example"], ["a tab trick", "%2F%09%2Fevil.example"]])(
    "never follows %s in `next`",
    async (_label, next) => {
      exchangeCodeForSession.mockResolvedValue({ error: null });
      const response = await callback(`?code=abc&next=${next}`);
      expect(response.headers.get("location")).toBe("http://localhost:3000/rooms");
    },
  );

  it("reports expired links, or links opened in another browser", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: "bad_code_verifier" } });
    const response = await callback("?code=abc");
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link");
  });

  it("reports links Supabase already rejected, without calling it", async () => {
    const response = await callback("?error=access_denied&error_code=otp_expired");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link");
  });
});
