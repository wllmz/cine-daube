"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { castFinishVoteAction } from "../actions/prediction-actions";
import type { PendingFinishVote } from "../types";

/**
 * Room-wide notification: someone says the film is over. Shown on every page
 * of the room until the member answers (realtime refreshes it), except the
 * film's own page, which has the vote already.
 */
export function FinishVoteBanner({ roomId, votes }: { roomId: string; votes: PendingFinishVote[] }) {
  const pathname = usePathname();
  const vote = votes.find((pending) => pathname !== `/rooms/${roomId}/movies/${pending.movieId}`);
  // Keyed by vote: a new one starts without the previous error.
  return vote ? <Banner key={vote.proposalId} roomId={roomId} vote={vote} /> : null;
}

function Banner({ roomId, vote }: { roomId: string; vote: PendingFinishVote }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function answer(value: "yes" | "no") {
    setError(undefined);
    startTransition(async () => {
      setError((await castFinishVoteAction(roomId, vote.proposalId, value)).error);
    });
  }

  return (
    // Sticky rather than fixed: at the end of the page it sits above the TMDB credits instead of covering them.
    <div className="pointer-events-none sticky bottom-0 z-20 px-4 pb-4">
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
  );
}
