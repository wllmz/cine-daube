"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { cn } from "@/lib/utils";
import { castVoteAction, markSeenAction } from "../actions/roulette-actions";
import type { SpinVoter, VoteValue } from "../types";

type VotePanelProps = {
  roomId: string;
  spinId: string;
  voters: SpinVoter[];
  currentUserId: string;
};

const VOTE_BADGE: Record<VoteValue, { label: string; className: string }> = {
  yes: { label: "Oui", className: "bg-success text-white" },
  no: { label: "Non", className: "bg-accent text-white" },
};

export function VotePanel({ roomId, spinId, voters, currentUserId }: VotePanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const me = voters.find((voter) => voter.userId === currentUserId);
  const votedCount = voters.filter((voter) => voter.vote !== null).length;

  function run(action: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-3.5" aria-label="Vote">
      <div className="flex items-center justify-between gap-3 rounded-[14px] bg-subtle px-3 py-2.5">
        <span className="text-[13px] font-semibold">
          Vous le regardez ? <span className="font-normal text-muted">{votedCount}/{voters.length}</span>
        </span>
        <ul className="flex gap-1.5">
          {voters.map((voter) => (
            <li key={voter.userId} className="relative" title={`${voter.pseudo} : ${voter.vote ? VOTE_BADGE[voter.vote].label : "pas encore voté"}`}>
              <Avatar id={voter.userId} pseudo={voter.pseudo} size="sm" />
              <span className="sr-only">
                {voter.vote === "yes" ? " a voté oui" : voter.vote === "no" ? " a voté non" : " n'a pas encore voté"}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border-2 border-subtle text-[8px] font-bold",
                  voter.vote ? VOTE_BADGE[voter.vote].className : "bg-faint",
                )}
              >
                {voter.vote === "yes" ? "✓" : voter.vote === "no" ? "×" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error && <FormAlert tone="error">{error}</FormAlert>}

      {me ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={pending}
            aria-pressed={me.vote === "no"}
            className={cn("h-[52px] text-[15px]", me.vote === "no" && "ring-2 ring-accent")}
            onClick={() => run(() => castVoteAction(roomId, spinId, "no"))}
          >
            Non, on relance
          </Button>
          <Button
            disabled={pending}
            aria-pressed={me.vote === "yes"}
            className={cn("h-[52px] text-[15px]", me.vote === "yes" && "ring-2 ring-ink ring-offset-2")}
            onClick={() => run(() => castVoteAction(roomId, spinId, "yes"))}
          >
            Oui, on souffre
          </Button>
        </div>
      ) : (
        <p className="text-center text-[13px] text-muted">Tu n&apos;étais pas coché pour ce vote, regarde les autres décider.</p>
      )}

      {me && (
        <Button variant="ghost" disabled={pending} onClick={() => run(() => markSeenAction(roomId, spinId))}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Déjà vu · le retirer de la roulette
        </Button>
      )}
    </section>
  );
}
