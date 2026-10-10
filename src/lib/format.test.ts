import { describe, expect, it } from "vitest";
import { formatScore } from "./format";

describe("formatScore", () => {
  it("uses a comma and one decimal", () => {
    expect(formatScore(1.875)).toBe("1,9");
  });

  it("keeps a trailing zero", () => {
    expect(formatScore(2)).toBe("2,0");
  });

  it("handles the bounds", () => {
    expect(formatScore(0)).toBe("0,0");
    expect(formatScore(10)).toBe("10,0");
  });
});
