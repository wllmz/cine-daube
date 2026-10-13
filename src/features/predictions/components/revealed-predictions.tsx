import { Avatar } from "@/components/ui/avatar";
import type { PredictionAuthor } from "../types";

/** Everyone's predictions, once the film is finished. */
export function RevealedPredictions({ authors }: { authors: PredictionAuthor[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-semibold text-muted">Les prédictions</h2>
      {authors.length === 0 ? (
        <p className="text-sm text-muted">Personne n&apos;a rien prédit sur ce film.</p>
      ) : (
        authors.map((author) => (
          <div key={author.userId} className="flex gap-2.5">
            <Avatar id={author.userId} pseudo={author.pseudo} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-sm font-semibold" aria-hidden="true">
                {author.pseudo}
              </span>
              <ul className="flex flex-col gap-1">
                {author.predictions.map((prediction) => (
                  <li key={prediction.id} className="rounded-[12px] bg-subtle px-3 py-2 text-sm break-words">
                    {prediction.content}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
