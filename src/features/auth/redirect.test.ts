import { describe, expect, it } from "vitest";
import { AFTER_SIGN_IN_PATH, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query string", () => {
    expect(safeNextPath("/rooms/abc?tab=films")).toBe("/rooms/abc?tab=films");
  });

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a relative path", "rooms"],
    ["an empty string", ""],
    ["a missing value", null],
  ])("falls back on %s", (_label, value) => {
    expect(safeNextPath(value)).toBe(AFTER_SIGN_IN_PATH);
  });
});
