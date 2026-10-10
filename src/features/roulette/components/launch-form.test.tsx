import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const presence = {
  onlineIds: new Set<string>(),
  ready: false,
  currentUserId: "will",
};

vi.mock("@/features/realtime", () => ({ useRoomPresence: () => presence }));
vi.mock("../actions/roulette-actions", () => ({ startSpinAction: async () => ({}) }));

const { LaunchForm } = await import("./launch-form");

const MEMBERS = [
  { id: "will", pseudo: "Will", role: "admin" as const, joinedAt: new Date() },
  { id: "sarah", pseudo: "Sarah", role: "member" as const, joinedAt: new Date() },
  { id: "momo", pseudo: "Momo", role: "member" as const, joinedAt: new Date() },
];

function checked(): string[] {
  return screen
    .getAllByRole<HTMLInputElement>("checkbox")
    .filter((box) => box.checked)
    .map((box) => box.value);
}

beforeEach(() => {
  presence.onlineIds = new Set();
  presence.ready = false;
});

describe("LaunchForm", () => {
  it("checks everyone until presence is known", () => {
    render(<LaunchForm roomId="room-1" members={MEMBERS} />);
    expect(checked()).toEqual(["will", "sarah", "momo"]);
  });

  it("checks the members online plus the launcher, even if their own presence is not in yet", () => {
    presence.ready = true;
    presence.onlineIds = new Set(["sarah"]);
    render(<LaunchForm roomId="room-1" members={MEMBERS} />);
    expect(checked()).toEqual(["will", "sarah"]);
  });

  it("checks only the launcher when nobody else is online", () => {
    presence.ready = true;
    presence.onlineIds = new Set(["will"]);
    render(<LaunchForm roomId="room-1" members={MEMBERS} />);
    expect(checked()).toEqual(["will"]);
  });
});
