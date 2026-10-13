import { describe, expect, it } from "vitest";
import { rankEntries } from "./ranking";

const entry = (pseudo: string, points: number) => ({ userId: pseudo, pseudo, points, judged: points });

describe("rankEntries", () => {
  it("ranks by points and shares the rank on a tie", () => {
    const ranked = rankEntries([entry("Momo", 2), entry("Will", 5), entry("Sarah", 5), entry("Julie", 0)]);
    expect(ranked.map((e) => [e.pseudo, e.rank])).toEqual([
      ["Sarah", 1],
      ["Will", 1],
      ["Momo", 3],
      ["Julie", 4],
    ]);
  });

  it("keeps everyone first when nobody scored yet", () => {
    expect(rankEntries([entry("Will", 0), entry("Sarah", 0)]).map((e) => e.rank)).toEqual([1, 1]);
  });
});
