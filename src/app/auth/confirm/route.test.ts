// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp } }),
}));

const { GET } = await import("./route");

function confirm(query: string) {
  return GET(new NextRequest(new URL(`/auth/confirm${query}`, "http://localhost:3000")));
}

beforeEach(() => {
  verifyOtp.mockReset();
});

describe("GET /auth/confirm", () => {
  it("signs in after an email confirmation", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await confirm("?token_hash=abc&type=email");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(response.headers.get("location")).toBe("http://localhost:3000/rooms");
  });

  it("opens the new password form after a recovery link", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await confirm("?token_hash=abc&type=recovery");
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  });

  it("ignores any destination passed in the link", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const response = await confirm("?token_hash=abc&type=email&next=https://evil.example");
    expect(response.headers.get("location")).toBe("http://localhost:3000/rooms");
  });

  it("reports expired or reused links", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await confirm("?token_hash=abc&type=recovery");
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link");
  });

  it.each([["missing token", "?type=email"], ["unknown type", "?token_hash=abc&type=invite"]])(
    "rejects a malformed link (%s) without calling Supabase",
    async (_label, query) => {
      const response = await confirm(query);
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=link");
    },
  );
});
