import { describe, expect, it } from "vitest";
import { resolveVote } from "./vote";

describe("resolveVote", () => {
  it.each([
    // eligible, yes, no, outcome
    [1, 1, 0, "accepted"],
    [1, 0, 1, "rejected"],
    [1, 0, 0, "pending"],
    [3, 2, 0, "accepted"],
    [3, 1, 1, "pending"],
    [3, 0, 2, "rejected"],
    [4, 2, 1, "pending"],
    [4, 3, 0, "accepted"],
    [4, 2, 2, "tie"],
    [4, 1, 3, "rejected"],
    [2, 1, 1, "tie"],
    [5, 2, 2, "pending"],
    [5, 3, 2, "accepted"],
  ] as const)("%i voters, %i yes, %i no → %s", (eligible, yes, no, outcome) => {
    expect(resolveVote({ eligible, yes, no })).toBe(outcome);
  });

  it("stays pending without voters", () => {
    expect(resolveVote({ eligible: 0, yes: 0, no: 0 })).toBe("pending");
  });
});
