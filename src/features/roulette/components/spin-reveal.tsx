"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { RouletteWheel } from "./roulette-wheel";

const SPIN_DURATION_MS = 2600;

/** "unknown" until the browser has decided, so the film is never shown before the wheel. */
type Phase = "unknown" | "spinning" | "done";

const phases = new Map<string, Phase>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function storageKey(spinId: string) {
  return `cine-daube:spin-seen:${spinId}`;
}

/** Remembers in this tab which spins were already revealed. */
function markSeen(spinId: string): boolean {
  try {
    const key = storageKey(spinId);
    const seen = window.sessionStorage.getItem(key) !== null;
    window.sessionStorage.setItem(key, "1");
    return seen;
  } catch {
    // Private mode: the wheel just plays again next time.
    return false;
  }
}

/** Decides once per spin whether to play the wheel. Returns true if the phase changed. */
function decide(spinId: string): boolean {
  if (phases.has(spinId)) return false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (markSeen(spinId) || reducedMotion) {
    phases.set(spinId, "done");
    return true;
  }
  phases.set(spinId, "spinning");
  window.setTimeout(() => {
    phases.set(spinId, "done");
    notify();
  }, SPIN_DURATION_MS);
  return true;
}

function useSpinPhase(spinId: string): Phase {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (decide(spinId)) notify();
      return () => listeners.delete(listener);
    },
    () => phases.get(spinId) ?? "unknown",
    () => "unknown",
  );
}

/**
 * Plays the wheel the first time this tab sees a spin (the launcher, or
 * friends whose page refreshes onto it), then reveals the film.
 */
type SpinRevealProps = {
  spinId: string;
  /** Read to screen readers once the wheel stops, e.g. "Film tiré : …". */
  announcement: string;
  children: ReactNode;
};

export function SpinReveal({ spinId, announcement, children }: SpinRevealProps) {
  const phase = useSpinPhase(spinId);

  return (
    <>
      {/* One live region for the whole sequence, so the result is announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {phase === "spinning" ? "La roue tourne…" : phase === "done" ? announcement : ""}
      </p>
      {phase === "unknown" && <div aria-hidden="true" className="h-[420px]" />}
      {phase === "spinning" && (
        <div className="flex flex-col items-center gap-5 py-6" aria-hidden="true">
          <RouletteWheel spinning />
          <p className="text-xl font-extrabold tracking-tight">Ça tourne…</p>
        </div>
      )}
      {phase === "done" && <div className="animate-fade-up">{children}</div>}
    </>
  );
}
