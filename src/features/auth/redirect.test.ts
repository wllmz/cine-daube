import { describe, expect, it } from "vitest";
import { AFTER_SIGN_IN_PATH, safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths with their query string and hash", () => {
    expect(safeNextPath("/rooms/abc?tab=films#top")).toBe("/rooms/abc?tab=films#top");
  });

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a tab trick", "/\t/evil.example"],
    ["a newline trick", "/\n/evil.example"],
    ["a carriage return trick", "/\r/evil.example"],
    ["a relative path", "rooms"],
    ["an empty string", ""],
    ["a missing value", null],
  ])("falls back on %s", (_label, value) => {
    expect(safeNextPath(value)).toBe(AFTER_SIGN_IN_PATH);
  });
});
