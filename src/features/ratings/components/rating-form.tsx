"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { Tomy, type TomyMood } from "@/components/ui/tomy";
import { formatScore } from "@/lib/format";
import { rateMovieAction } from "../actions/rating-actions";
import { personalAverage, verdict, type Scores } from "../scores";
import type { RatingFormState } from "../types";

type RatingFormProps = {
  roomId: string;
  movieId: number;
  initial: Scores | null;
};

function moodFor(average: number): TomyMood {
  if (average >= 5) return "content";
  if (average >= 3) return "choque";
  return "degoute";
}

function ScoreSlider({
  id,
  name,
  label,
  value,
  onChange,
  low,
  high,
  muted = false,
}: {
  id: string;
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  low: string;
  high: string;
  muted?: boolean;
}) {
  const fill = muted ? "#71717a" : "#cf3e2a";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[15px] font-bold">
          {label}
        </label>
        <span className="text-xl font-extrabold" aria-hidden="true">
          {value}
          <span className="text-[13px] font-semibold text-muted">/10</span>
        </span>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={`${value} sur 10`}
        className="my-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-accent"
        style={{ background: `linear-gradient(to right, ${fill} ${value * 10}%, #ececea ${value * 10}%)` }}
      />
      <div className="flex justify-between text-[11px] text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function RatingForm({ roomId, movieId, initial }: RatingFormProps) {
  const [humour, setHumour] = useState(initial?.humour ?? 5);
  const [scenario, setScenario] = useState(initial?.scenario ?? 5);
  const [actingEnabled, setActingEnabled] = useState(initial?.acting !== null && initial?.acting !== undefined);
  const [acting, setActing] = useState(initial?.acting ?? 5);
  const [state, formAction, pending] = useActionState<RatingFormState, FormData>(
    rateMovieAction.bind(null, roomId, String(movieId)),
    {},
  );
  const average = personalAverage({ humour, scenario });

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <section aria-live="polite" className="flex items-center gap-2 rounded-[22px] bg-accent-soft py-3.5 pr-4 pl-2.5">
        <Tomy mood={moodFor(average)} size={84} />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-muted">Ta moyenne</span>
          <span className="leading-none font-extrabold tracking-tight">
            <span className="text-[44px] text-accent">{formatScore(average)}</span>
            <span className="text-lg text-muted"> /10</span>
          </span>
          <span className="text-[13px] font-semibold">{verdict(average)}</span>
        </div>
      </section>

      <section className="rounded-[18px] border border-line bg-surface px-4 pt-3.5 pb-2.5 shadow-card">
        <ScoreSlider id="humour" name="humour" label="Humour" value={humour} onChange={setHumour} low="Pas un rire" high="Mort de rire" />
      </section>
      <section className="rounded-[18px] border border-line bg-surface px-4 pt-3.5 pb-2.5 shadow-card">
        <ScoreSlider id="scenario" name="scenario" label="Scénario" value={scenario} onChange={setScenario} low="Quel scénario ?" high="Chef-d'œuvre" />
      </section>

      <section className="flex flex-col rounded-[18px] bg-subtle px-4 pt-3.5 pb-3">
        <label htmlFor="actingEnabled" className="flex cursor-pointer items-center gap-2.5 text-[15px] font-bold">
          <input
            id="actingEnabled"
            name="actingEnabled"
            type="checkbox"
            checked={actingEnabled}
            onChange={(event) => setActingEnabled(event.target.checked)}
            className="size-5 accent-accent"
          />
          Jeu d&apos;acteur
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">Bonus</span>
        </label>
        {actingEnabled && (
          <div className="mt-2">
            <ScoreSlider id="acting" name="acting" label="Note du jeu d'acteur" value={acting} onChange={setActing} low="Bois brut" high="César mérité" muted />
          </div>
        )}
        <span className="mt-1 text-xs text-muted">Facultatif, ne compte pas dans la moyenne.</span>
      </section>

      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : initial ? "Modifier ma note" : "Valider ma note"}
      </Button>
    </form>
  );
}
