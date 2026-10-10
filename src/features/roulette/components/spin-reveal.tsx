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

function decide(spinId: string) {
  if (phases.has(spinId)) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (markSeen(spinId) || reducedMotion) {
    phases.set(spinId, "done");
    return;
  }
  phases.set(spinId, "spinning");
  window.setTimeout(() => {
    phases.set(spinId, "done");
    notify();
  }, SPIN_DURATION_MS);
}

function useSpinPhase(spinId: string): Phase {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      decide(spinId);
      notify();
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
export function SpinReveal({ spinId, children }: { spinId: string; children: ReactNode }) {
  const phase = useSpinPhase(spinId);

  if (phase === "unknown") {
    return <div aria-hidden="true" className="h-[420px]" />;
  }
  if (phase === "spinning") {
    return (
      <div className="flex flex-col items-center gap-5 py-6" role="status" aria-live="polite">
        <RouletteWheel spinning />
        <p className="text-xl font-extrabold tracking-tight">Ça tourne…</p>
      </div>
    );
  }
  return <div className="animate-fade-up">{children}</div>;
}
