"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { castFinishVoteAction } from "../actions/prediction-actions";
import type { PendingFinishVote } from "../types";

/**
 * Room-wide notification: someone says the film is over. Shown on every page
 * of the room until the member answers (realtime refreshes it).
 */
export function FinishVoteBanner({ roomId, votes }: { roomId: string; votes: PendingFinishVote[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const vote = votes[0];
  if (!vote) return null;
  const { proposalId } = vote;

  function answer(value: "yes" | "no") {
    setError(undefined);
    startTransition(async () => {
      setError((await castFinishVoteAction(roomId, proposalId, value)).error);
    });
  }

  return (
    <>
      {/* Keeps the end of the page reachable above the banner. */}
      <div aria-hidden="true" className="h-40 shrink-0" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
        <section
          role="status"
          aria-label="Film terminé ?"
          className="pointer-events-auto mx-auto flex w-full max-w-md animate-fade-up flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card"
        >
          <p className="text-sm">
            <strong>{vote.proposedBy ?? "Quelqu'un"}</strong> a fini{" "}
            <Link href={`/rooms/${roomId}/movies/${vote.movieId}`} className="font-semibold underline underline-offset-2">
              {vote.title}
            </Link>
            . Et toi ?
          </p>
          {error && <p className="text-[13px] text-accent-strong">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={pending} className="h-11 text-sm" onClick={() => answer("no")}>
              Pas encore
            </Button>
            <Button disabled={pending} className="h-11 text-sm" onClick={() => answer("yes")}>
              J&apos;ai fini
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
