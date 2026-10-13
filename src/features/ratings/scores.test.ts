import { describe, expect, it } from "vitest";
import { personalAverage, sortByScore, summarize, verdict } from "./scores";

describe("sortByScore", () => {
  // Given newest first, as the watched list comes.
  const movies = [
    { title: "Pas noté", summary: { average: null } },
    { title: "Récent à 3", summary: { average: 3 } },
    { title: "Pire", summary: { average: 1.5 } },
    { title: "Ancien à 3", summary: { average: 3 } },
    { title: "Meilleur", summary: { average: 6 } },
  ];
  const titles = (sorted: typeof movies) => sorted.map((movie) => movie.title);

  it("puts the worst first, unrated last, ties newest first", () => {
    expect(titles(sortByScore(movies, "worst"))).toEqual(["Pire", "Récent à 3", "Ancien à 3", "Meilleur", "Pas noté"]);
  });

  it("puts the best first, still with unrated films last", () => {
    expect(titles(sortByScore(movies, "best"))).toEqual(["Meilleur", "Récent à 3", "Ancien à 3", "Pire", "Pas noté"]);
  });

  it("keeps the watch order for recent", () => {
    expect(titles(sortByScore(movies, "recent"))).toEqual(titles(movies));
  });
});

describe("personalAverage", () => {
  it("weights humour and scenario equally", () => {
    expect(personalAverage({ humour: 3, scenario: 2 })).toBe(2.5);
  });
});

describe("summarize", () => {
  // The worked example from the mockups: room average 1.9, bonus 3.5.
  const room = [
    { humour: 2, scenario: 1, acting: 3 },
    { humour: 3, scenario: 2, acting: null },
    { humour: 1, scenario: 2, acting: 4 },
    { humour: 2, scenario: 2, acting: null },
  ];

  it("averages the members' grades, leaving the bonus out", () => {
    expect(summarize(room)).toEqual({
      count: 4,
      average: 1.875,
      humour: 2,
      scenario: 1.75,
      acting: 3.5,
      actingCount: 2,
    });
  });

  it("is empty until someone rates", () => {
    expect(summarize([])).toEqual({
      count: 0,
      average: null,
      humour: null,
      scenario: null,
      acting: null,
      actingCount: 0,
    });
  });

  it("has no bonus average when nobody gave one", () => {
    expect(summarize([{ humour: 5, scenario: 5, acting: null }]).acting).toBeNull();
  });
});

describe("verdict", () => {
  it.each([
    [1.9, "Une daube de compétition."],
    [3, "Pas loin du Navet d'Or."],
    [5.5, "Étonnamment regardable."],
    [8, "Attends… c'était bien ?"],
  ])("%d → %s", (average, text) => {
    expect(verdict(average)).toBe(text);
  });
});
