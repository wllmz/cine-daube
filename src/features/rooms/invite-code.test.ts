import { describe, expect, it } from "vitest";
import {
  INVITE_CODE_ALPHABET,
  formatInviteCode,
  generateInviteCode,
  inviteExpiryFrom,
  normalizeInviteCode,
} from "./invite-code";

describe("generateInviteCode", () => {
  it("returns 6 unambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(new RegExp(`^[${INVITE_CODE_ALPHABET}]{6}$`));
    }
  });

  it("maps random values onto the alphabet", () => {
    const code = generateInviteCode((array) => array.fill(0));
    expect(code).toBe("222222");
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["7K2QXM", "7K2QXM"],
    ["daube-7k2qxm", "7K2QXM"],
    ["DAUBE-7K2QXM", "7K2QXM"],
    ["  7K2 QXM ", "7K2QXM"],
    ["https://cine-daube.vercel.app/join/7K2QXM", "7K2QXM"],
    // A bare code may itself start with the brand letters.
    ["DAUBE7", "DAUBE7"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each([["too short", "7K2QX"], ["ambiguous letters", "7K2QX0"], ["empty", ""], ["garbage", "hello!"]])(
    "rejects %s",
    (_label, input) => {
      expect(normalizeInviteCode(input)).toBeNull();
    },
  );
});

describe("helpers", () => {
  it("formats the code with the brand prefix", () => {
    expect(formatInviteCode("7K2QXM")).toBe("DAUBE-7K2QXM");
  });

  it("expires 7 days later", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(inviteExpiryFrom(now).toISOString()).toBe("2026-10-17T12:00:00.000Z");
  });
});
