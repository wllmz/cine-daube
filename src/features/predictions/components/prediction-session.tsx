import { plural } from "@/lib/format";
import type { PredictionBoard } from "../types";
import { FinishVotePanel } from "./finish-vote-panel";
import { PredictionForm } from "./prediction-form";

type PredictionSessionProps = {
  roomId: string;
  board: PredictionBoard;
  currentUserId: string;
};

/** While the film is on: my predictions, who predicted how much, and the end vote. */
export function PredictionSession({ roomId, board, currentUserId }: PredictionSessionProps) {
  const others = board.participants.filter((p) => p.userId !== currentUserId);

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[18px] shadow-card">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-accent">Séance en cours</span>
        <p className="text-sm text-muted">
          Prédis ce qui va se passer. C&apos;est caché jusqu&apos;à la fin du film, personne ne copie.
        </p>
      </div>

      {board.isParticipant ? (
        <PredictionForm roomId={roomId} movieId={board.movie.tmdbId} predictions={board.myPredictions} />
      ) : (
        <p className="text-sm text-muted">Tu n&apos;étais pas là pour ce film : regarde les autres prédire.</p>
      )}

      {others.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {others.map((p) => (
            <li key={p.userId} className="rounded-full bg-chip px-2.5 py-1 text-xs text-ink-soft">
              <strong className="font-semibold">{p.pseudo}</strong> · {plural(p.predictionCount, "prédiction")}
            </li>
          ))}
        </ul>
      )}

      <FinishVotePanel
        roomId={roomId}
        movieId={board.movie.tmdbId}
        finishVote={board.finishVote}
        currentUserId={currentUserId}
        isParticipant={board.isParticipant}
      />
    </section>
  );
}
