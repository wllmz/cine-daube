import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpinReveal } from "./spin-reveal";

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  mockReducedMotion(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SpinReveal", () => {
  it("spins the wheel before revealing a new spin, then not again", () => {
    const { unmount } = render(
      <SpinReveal spinId="spin-1" announcement="Film tiré : Opération Raclette">
        Fiche du film
      </SpinReveal>,
    );
    expect(screen.getByText("Ça tourne…")).toBeTruthy();
    expect(screen.queryByText("Fiche du film")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText("Fiche du film")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Film tiré : Opération Raclette");
    unmount();

    render(
      <SpinReveal spinId="spin-1" announcement="Film tiré : Opération Raclette">
        Fiche du film
      </SpinReveal>,
    );
    expect(screen.getByText("Fiche du film")).toBeTruthy();
  });

  it("skips the animation for users who prefer reduced motion", () => {
    mockReducedMotion(true);
    render(
      <SpinReveal spinId="spin-2" announcement="Film tiré : Mariage à la plancha">
        Mariage à la plancha
      </SpinReveal>,
    );
    expect(screen.getByText("Mariage à la plancha")).toBeTruthy();
  });
});
