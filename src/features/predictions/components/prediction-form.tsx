"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { addPredictionAction, deletePredictionAction } from "../actions/prediction-actions";
import { MAX_PREDICTIONS } from "../rules";
import type { Prediction, PredictionActionState } from "../types";

type PredictionFormProps = {
  roomId: string;
  movieId: number;
  predictions: Prediction[];
};

/** The member's own predictions while the film is on: add, list, delete. */
export function PredictionForm({ roomId, movieId, predictions }: PredictionFormProps) {
  const [state, formAction, adding] = useActionState<PredictionActionState, FormData>(
    addPredictionAction.bind(null, roomId, movieId),
    {},
  );
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();
  const full = predictions.length >= MAX_PREDICTIONS;
  const error = state.error ?? deleteError;

  function remove(predictionId: string) {
    setDeleteError(undefined);
    startDelete(async () => {
      const result = await deletePredictionAction(roomId, movieId, predictionId);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-bold">Mes prédictions</h3>
        <span className="text-[13px] text-muted">
          {predictions.length}/{MAX_PREDICTIONS}
        </span>
      </div>

      {predictions.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {predictions.map((prediction, index) => (
            <li key={prediction.id} className="flex items-center gap-2.5 rounded-[12px] bg-subtle py-2 pr-1.5 pl-3 text-sm">
              <span className="w-4 text-xs font-bold text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 break-words">{prediction.content}</span>
              <button
                type="button"
                disabled={deleting}
                onClick={() => remove(prediction.id)}
                aria-label={`Supprimer « ${prediction.content} »`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-ink disabled:opacity-55"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      {error && <FormAlert tone="error">{error}</FormAlert>}

      {full ? (
        <p className="text-[13px] text-muted">
          Tu as fait tes {MAX_PREDICTIONS} prédictions. Supprimes-en une pour changer d&apos;avis.
        </p>
      ) : (
        <form action={formAction} className="flex gap-2">
          <label htmlFor="prediction-content" className="sr-only">
            Nouvelle prédiction
          </label>
          <input
            id="prediction-content"
            name="content"
            required
            maxLength={140}
            autoComplete="off"
            placeholder="Ex. : le héros finit dans une piscine"
            className="h-12 min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-3.5 text-sm outline-none focus:border-ink"
          />
          <Button type="submit" disabled={adding} className="h-12 px-4 text-sm">
            Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}
