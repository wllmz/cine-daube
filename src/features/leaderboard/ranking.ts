import type { LeaderboardEntry } from "./types";

/**
 * Sorts by points (then by pseudo) and gives tied members the same rank,
 * the next one skipping as many places: 1, 1, 3.
 */
export function rankEntries(entries: Omit<LeaderboardEntry, "rank">[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points || a.pseudo.localeCompare(b.pseudo, "fr"));
  return sorted.map((entry) => ({
    ...entry,
    rank: 1 + sorted.filter((other) => other.points > entry.points).length,
  }));
}
