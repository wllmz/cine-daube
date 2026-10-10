import { describe, expect, it } from "vitest";
import { newPasswordSchema, signUpSchema } from "./schemas";

describe("signUpSchema", () => {
  it("normalises the email and trims the pseudo", () => {
    const result = signUpSchema.parse({
      pseudo: "  Will  ",
      email: "  Will@Example.FR ",
      password: "nanar1234",
    });
    expect(result).toEqual({ pseudo: "Will", email: "will@example.fr", password: "nanar1234" });
  });

  it.each([
    ["blank pseudo", { pseudo: "   " }, "pseudo"],
    ["pseudo over 30 characters", { pseudo: "x".repeat(31) }, "pseudo"],
    ["invalid email", { email: "pas-un-email" }, "email"],
    ["short password", { password: "1234567" }, "password"],
    ["password over 72 characters", { password: "x".repeat(73) }, "password"],
  ])("rejects a %s", (_label, override, field) => {
    const result = signUpSchema.safeParse({
      pseudo: "Will",
      email: "will@example.fr",
      password: "nanar1234",
      ...override,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });
});

describe("newPasswordSchema", () => {
  it("requires both passwords to match", () => {
    const result = newPasswordSchema.safeParse({ password: "nanar1234", confirmation: "nanar12345" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmation"]);
  });
});
