// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));
vi.mock("@/config/env", () => ({
  getServerEnv: () => ({ DATABASE_URL: "postgres://unused", SITE_URL: "https://cinedaube.test" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectSignal(path);
  },
}));

class RedirectSignal extends Error {
  constructor(public readonly path: string) {
    super(`redirect:${path}`);
  }
}

const { requestPasswordReset, signIn, signOut, signUp, updatePassword } = await import(
  "./auth-actions"
);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}

async function redirectPathOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((caught: unknown) => caught);
  if (!(error instanceof RedirectSignal)) throw new Error("Expected a redirect");
  return error.path;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signIn", () => {
  it("returns field errors without calling Supabase when input is invalid", async () => {
    const state = await signIn({}, form({ email: "nope", password: "" }));
    expect(state.fieldErrors).toMatchObject({
      email: "Cet email n'est pas valide.",
      password: "Entre ton mot de passe.",
    });
    expect(state.values?.email).toBe("nope");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("maps Supabase errors to a French message", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const state = await signIn({}, form({ email: "will@example.fr", password: "wrong" }));
    expect(state.error).toBe("Email ou mot de passe incorrect.");
  });

  it("redirects to a safe `next` path on success", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const path = await redirectPathOf(
      signIn({}, form({ email: "will@example.fr", password: "nanar1234", next: "/rooms/abc" })),
    );
    expect(path).toBe("/rooms/abc");
  });

  it("ignores an external `next` URL", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const path = await redirectPathOf(
      signIn({}, form({ email: "will@example.fr", password: "nanar1234", next: "https://evil.example" })),
    );
    expect(path).toBe("/rooms");
  });
});

describe("signUp", () => {
  const valid = { pseudo: " Will ", email: "Will@Example.fr", password: "nanar1234" };

  it("passes the pseudo to Supabase for the profile trigger", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await signUp({}, form(valid));
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "will@example.fr",
      password: "nanar1234",
      options: {
        data: { pseudo: "Will" },
        emailRedirectTo: "https://cinedaube.test/auth/callback?next=%2Frooms",
      },
    });
  });

  it("asks to confirm the email when no session is returned", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const state = await signUp({}, form(valid));
    expect(state.success).toContain("will@example.fr");
  });

  it("keeps the invite link through signup, for both email and immediate sessions", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await signUp({}, form({ ...valid, next: "/join/7K2QXM" }));
    expect(auth.signUp.mock.calls[0]?.[0].options.emailRedirectTo).toBe(
      "https://cinedaube.test/auth/callback?next=%2Fjoin%2F7K2QXM",
    );

    auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    expect(await redirectPathOf(signUp({}, form({ ...valid, next: "/join/7K2QXM" })))).toBe("/join/7K2QXM");
  });

  it("ignores an external `next` at signup", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    expect(await redirectPathOf(signUp({}, form({ ...valid, next: "/\t/evil.example" })))).toBe("/rooms");
  });

  it("goes straight to the rooms when email confirmation is off", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    expect(await redirectPathOf(signUp({}, form(valid)))).toBe("/rooms");
  });

  it("keeps what the user typed on error", async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: { code: "weak_password" } });
    const state = await signUp({}, form(valid));
    expect(state.error).toBe("Mot de passe trop faible, choisis-en un plus costaud.");
    expect(state.values).toEqual({ email: "Will@Example.fr", pseudo: " Will " });
  });
});

describe("requestPasswordReset", () => {
  it("never reveals whether the account exists", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "user_not_found" } });
    const state = await requestPasswordReset({}, form({ email: "ghost@example.fr" }));
    expect(state.error).toBeUndefined();
    expect(state.success).toContain("Si un compte existe");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ghost@example.fr", {
      redirectTo: "https://cinedaube.test/auth/callback?next=%2Freset-password",
    });
  });

  it("surfaces rate limits", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "over_email_send_rate_limit" } });
    const state = await requestPasswordReset({}, form({ email: "will@example.fr" }));
    expect(state.error).toMatch(/Trop d'emails/);
  });
});

describe("updatePassword", () => {
  it("rejects mismatched passwords before calling Supabase", async () => {
    const state = await updatePassword({}, form({ password: "nanar1234", confirmation: "autre1234" }));
    expect(state.fieldErrors?.confirmation).toBe("Les deux mots de passe ne correspondent pas.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("ends the other sessions, then redirects to the rooms", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const path = await redirectPathOf(
      updatePassword({}, form({ password: "nanar1234", confirmation: "nanar1234" })),
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(path).toBe("/rooms");
  });

  it("does not sign anyone out when the update fails", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "same_password" } });
    const state = await updatePassword({}, form({ password: "nanar1234", confirmation: "nanar1234" }));
    expect(state.error).toBe("Choisis un mot de passe différent de l'ancien.");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out this device only, then goes to login", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    expect(await redirectPathOf(signOut())).toBe("/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("reports a failure instead of pretending it worked", async () => {
    auth.signOut.mockResolvedValue({ error: { code: "unexpected_failure" } });
    const state = await signOut();
    expect(state.error).toBe("Impossible de te déconnecter, réessaie.");
  });
});
