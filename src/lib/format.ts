const scoreFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Formats a 0–10 score the French way, always with one decimal: 1.875 → "1,9". */
export function formatScore(score: number): string {
  return scoreFormatter.format(score);
}

// Fixed time zone so server and browser render the same day.
const dayFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** "17 oct." */
export function formatShortDate(date: Date): string {
  return dayFormatter.format(date);
}

/** "17 oct. à 21:04" */
export function formatShortDateTime(date: Date): string {
  return `${dayFormatter.format(date)} à ${timeFormatter.format(date)}`;
}

/** "1 membre", "4 membres" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}
