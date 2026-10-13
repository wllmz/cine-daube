"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { castPredictionVoteAction } from "../actions/prediction-actions";
import type { JudgedPrediction } from "../types";

type PredictionVerdictProps = {
  roomId: string;
  prediction: JudgedPrediction;
  /** The viewer may vote on it: a participant, not its author, while votes are open. */
  canVote: boolean;
};

/** The room's verdict on a prediction, or the yes / no buttons while it is judged. */
export function PredictionVerdict({ roomId, prediction, canVote }: PredictionVerdictProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  if (prediction.validated !== null) {
    return prediction.validated ? (
      <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Validée · +1</span>
    ) : (
      <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[11px] font-bold text-muted">Ratée</span>
    );
  }

  function vote(value: "yes" | "no") {
    setError(undefined);
    startTransition(async () => {
      setError((await castPredictionVoteAction(roomId, prediction.id, value)).error);
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {canVote ? (
        <span className="flex gap-1">
          {(["no", "yes"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={pending}
              aria-pressed={prediction.myVote === value}
              aria-label={value === "yes" ? `Valider « ${prediction.content} »` : `Refuser « ${prediction.content} »`}
              onClick={() => vote(value)}
              className={cn(
                "flex h-8 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold transition disabled:opacity-55",
                prediction.myVote === value
                  ? value === "yes"
                    ? "bg-success text-white"
                    : "bg-accent text-white"
                  : "bg-surface text-ink-soft shadow-[0_1px_3px_rgb(24_24_27/0.1)] hover:text-ink",
              )}
            >
              <span aria-hidden="true">{value === "yes" ? "✓" : "×"}</span>
              {value === "yes" ? prediction.yes : prediction.no}
            </button>
          ))}
        </span>
      ) : (
        <span className="text-[11px] text-muted">
          {prediction.yes} oui · {prediction.no} non
        </span>
      )}
      {error && (
        <span role="alert" className="text-[11px] text-accent-strong">
          {error}
        </span>
      )}
    </span>
  );
}
