export type Scores = {
  humour: number;
  scenario: number;
  /** Optional bonus, never part of the average. */
  acting: number | null;
};

/** A member's grade for a film: humour and scenario count equally. */
export function personalAverage({ humour, scenario }: Pick<Scores, "humour" | "scenario">): number {
  return (humour + scenario) / 2;
}

export type ScoreSummary = {
  count: number;
  /** Mean of the members' grades, null until someone rated. */
  average: number | null;
  humour: number | null;
  scenario: number | null;
  /** Mean of the bonus among those who gave one. */
  acting: number | null;
  actingCount: number;
};

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarize(ratings: Scores[]): ScoreSummary {
  const acting = ratings.flatMap((r) => (r.acting === null ? [] : [r.acting]));
  return {
    count: ratings.length,
    average: mean(ratings.map(personalAverage)),
    humour: mean(ratings.map((r) => r.humour)),
    scenario: mean(ratings.map((r) => r.scenario)),
    acting: mean(acting),
    actingCount: acting.length,
  };
}

export type MovieSort = "worst" | "recent" | "best";

/**
 * Orders watched films (given most recent first). Unrated films always come
 * last; ties keep the most recent first (stable sort).
 */
export function sortByScore<T extends { summary: { average: number | null } }>(movies: T[], sort: MovieSort): T[] {
  if (sort === "recent") return movies;
  const direction = sort === "worst" ? 1 : -1;
  const rated = movies.flatMap((movie) =>
    movie.summary.average === null ? [] : [{ movie, average: movie.summary.average }],
  );
  rated.sort((a, b) => direction * (a.average - b.average));
  return [...rated.map((entry) => entry.movie), ...movies.filter((movie) => movie.summary.average === null)];
}

/** "Une daube de compétition", "Étonnamment regardable"… for a 0–10 average. */
export function verdict(average: number): string {
  if (average >= 7) return "Attends… c'était bien ?";
  if (average >= 5) return "Étonnamment regardable.";
  if (average >= 3) return "Pas loin du Navet d'Or.";
  return "Une daube de compétition.";
}
