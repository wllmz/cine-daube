"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { cn } from "@/lib/utils";
import { castFinishVoteAction, proposeFinishAction } from "../actions/prediction-actions";
import type { FinishVote } from "../types";

type FinishVotePanelProps = {
  roomId: string;
  movieId: number;
  finishVote: FinishVote | null;
  currentUserId: string;
  isParticipant: boolean;
};

/** "Film terminé ?": propose the end, or answer the vote in progress. */
export function FinishVotePanel({ roomId, movieId, finishVote, currentUserId, isParticipant }: FinishVotePanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  // An expired vote no longer waits for anyone: proposing again settles it.
  const open = finishVote && !finishVote.expired ? finishVote : null;
  const me = open?.voters.find((voter) => voter.userId === currentUserId);

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      setError((await action()).error);
    });
  }

  if (!open) {
    if (!isParticipant) return null;
    return (
      <div className="flex flex-col gap-2">
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <Button variant="secondary" disabled={pending} onClick={() => run(() => proposeFinishAction(roomId, movieId))}>
          Film terminé ?
        </Button>
        <p className="text-center text-xs text-muted">La room vote : si la majorité a fini, les prédictions sont révélées.</p>
      </div>
    );
  }

  const answered = open.voters.filter((voter) => voter.vote !== null).length;
  return (
    <section aria-label="Vote de fin du film" className="flex flex-col gap-3 rounded-[16px] bg-subtle p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold">
          {open.proposedBy ? `${open.proposedBy} a fini le film.` : "Film terminé ?"}{" "}
          <span className="font-normal text-muted">
            {answered}/{open.voters.length}
          </span>
        </span>
        <ul className="flex gap-1">
          {open.voters.map((voter) => (
            <li key={voter.userId} className="relative">
              <Avatar id={voter.userId} pseudo={voter.pseudo} size="sm" />
              <span className="sr-only">
                {voter.vote === "yes" ? " a fini" : voter.vote === "no" ? " n'a pas fini" : " n'a pas encore répondu"}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border-2 border-subtle text-[8px] font-bold text-white",
                  voter.vote === "yes" ? "bg-success" : voter.vote === "no" ? "bg-accent" : "bg-faint",
                )}
              >
                {voter.vote === "yes" ? "✓" : voter.vote === "no" ? "×" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {error && <FormAlert tone="error">{error}</FormAlert>}
      {me && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            aria-pressed={me.vote === "no"}
            className={cn("h-12 bg-surface text-sm", me.vote === "no" && "ring-2 ring-accent")}
            onClick={() => run(() => castFinishVoteAction(roomId, open.proposalId, "no"))}
          >
            Pas encore
          </Button>
          <Button
            disabled={pending}
            aria-pressed={me.vote === "yes"}
            className={cn("h-12 text-sm", me.vote === "yes" && "ring-2 ring-ink ring-offset-2")}
            onClick={() => run(() => castFinishVoteAction(roomId, open.proposalId, "yes"))}
          >
            J&apos;ai fini
          </Button>
        </div>
      )}
    </section>
  );
}
