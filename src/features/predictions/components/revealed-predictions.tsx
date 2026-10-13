import { Avatar } from "@/components/ui/avatar";
import { formatShortDateTime, plural } from "@/lib/format";
import type { PredictionBoard } from "../types";
import { PredictionVerdict } from "./prediction-verdict";

type RevealedPredictionsProps = {
  roomId: string;
  board: PredictionBoard;
  currentUserId: string;
};

/** Everyone's predictions once the film is finished, judged by the room: 1 point each. */
export function RevealedPredictions({ roomId, board, currentUserId }: RevealedPredictionsProps) {
  const { revealed: authors, judgingEndsAt, canJudge } = board;
  const judging = authors.some((author) => author.predictions.some((p) => p.validated === null));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[13px] font-semibold text-muted">Les prédictions</h2>
        {judging && judgingEndsAt && (
          <p className="text-xs text-muted">
            {canJudge ? "Votez : chaque prédiction juste rapporte 1 point." : "La room vote sur chaque prédiction."} Votes
            ouverts jusqu&apos;au {formatShortDateTime(judgingEndsAt)}.
          </p>
        )}
      </div>
      {authors.length === 0 ? (
        <p className="text-sm text-muted">Personne n&apos;a rien prédit sur ce film.</p>
      ) : (
        authors.map((author) => (
          <div key={author.userId} className="flex gap-2.5">
            <Avatar id={author.userId} pseudo={author.pseudo} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold" aria-hidden="true">
                  {author.pseudo}
                </span>
                <span className="text-xs font-bold text-accent-strong">{plural(author.points, "point")}</span>
              </span>
              <ul className="flex flex-col gap-1">
                {author.predictions.map((prediction) => (
                  <li key={prediction.id} className="flex items-center gap-2 rounded-[12px] bg-subtle py-2 pr-2 pl-3 text-sm">
                    <span className="min-w-0 flex-1 break-words">{prediction.content}</span>
                    <PredictionVerdict
                      roomId={roomId}
                      prediction={prediction}
                      canVote={canJudge && author.userId !== currentUserId}
                    />
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
