import { describe, expect, it } from "vitest";
import { formatScore, formatShortDate, plural } from "./format";

describe("formatShortDate", () => {
  it("uses the Paris day, whatever the server time zone", () => {
    // 23:30 UTC on the 16th is already the 17th in Paris.
    expect(formatShortDate(new Date("2026-10-16T23:30:00Z"))).toBe("17 oct.");
  });
});

describe("plural", () => {
  it("agrees with the count", () => {
    expect(plural(0, "film")).toBe("0 film");
    expect(plural(1, "membre")).toBe("1 membre");
    expect(plural(4, "membre")).toBe("4 membres");
  });
});

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
