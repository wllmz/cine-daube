import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  formatInviteCode,
  generateInviteCode,
  inviteExpiryFrom,
  normalizeInviteCode,
} from "./invite-code";

describe("generateInviteCode", () => {
  it("returns 8 unambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{8}$`));
    }
  });

  it("maps random values onto the alphabet", () => {
    const code = generateInviteCode((array) => array.fill(0));
    expect(code).toBe("22222222");
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["7K2QXM9P", "7K2QXM9P"],
    ["daube-7k2qxm9p", "7K2QXM9P"],
    ["DAUBE-7K2QXM9P", "7K2QXM9P"],
    ["  7K2Q XM9P ", "7K2QXM9P"],
    ["https://cine-daube.vercel.app/join/7K2QXM9P", "7K2QXM9P"],
    // A bare code may itself start with the brand letters.
    ["DAUBE7K2", "DAUBE7K2"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each([
    ["too short", "7K2QXM9"],
    ["ambiguous letters", "7K2QXM90"],
    ["empty", ""],
    ["garbage", "hello!"],
    ["percent-encoded bytes", "%E0%E0%E0%E0"],
  ])("rejects %s", (_label, input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });
});

describe("helpers", () => {
  it("formats the code with the brand prefix", () => {
    expect(formatInviteCode("7K2QXM9P")).toBe("DAUBE-7K2QXM9P");
  });

  it("expires 7 days later", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(inviteExpiryFrom(now).toISOString()).toBe("2026-10-17T12:00:00.000Z");
  });
});
