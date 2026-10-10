const scoreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a 0–10 score the French way, always with one decimal: 1.875 → "1,9". */
export function formatScore(score: number): string {
  return scoreFormatter.format(score);
}
