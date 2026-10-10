// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "6f1c2c5e-8a5b-4c1e-9a7e-2f3d4b5c6d7e";
const SPIN_ID = "7a2b3c4d-1e2f-4a5b-8c6d-9e0f1a2b3c4d";
const SARAH = "8b3c4d5e-2f3a-4b5c-9d6e-0f1a2b3c4d5e";

const services = { startSpin: vi.fn(), castVote: vi.fn(), markSeenAndRelaunch: vi.fn() };
const refresh = vi.fn();

vi.mock("@/db", () => ({ getDb: () => "db" }));
vi.mock("@/features/auth/server", () => ({ getCurrentUser: async () => ({ id: "user-1", pseudo: "Will" }) }));
vi.mock("@/features/rooms/server", () => ({ requireRoomMember: async (id: string) => ({ id }) }));
vi.mock("../services/roulette-service", () => services);
vi.mock("next/cache", () => ({ refresh }));

const { castVoteAction, markSeenAction, startSpinAction } = await import("./roulette-actions");

function voters(...ids: string[]): FormData {
  const data = new FormData();
  ids.forEach((id) => data.append("voters", id));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("startSpinAction", () => {
  it("starts a spin for the checked members and refreshes", async () => {
    services.startSpin.mockResolvedValue({ status: "started", spinId: SPIN_ID });
    expect(await startSpinAction(ROOM_ID, {}, voters(SARAH))).toEqual({});
    expect(services.startSpin).toHaveBeenCalledWith("db", { roomId: ROOM_ID, userId: "user-1", voterIds: [SARAH] });
    expect(refresh).toHaveBeenCalled();
  });

  it.each([["nobody", voters()], ["a forged id", voters("../../x")]])("refuses %s", async (_label, form) => {
    expect((await startSpinAction(ROOM_ID, {}, form)).error).toBe("Coche au moins une personne présente ce soir.");
    expect(services.startSpin).not.toHaveBeenCalled();
  });

  it("explains an empty pool", async () => {
    services.startSpin.mockResolvedValue({ status: "empty_pool" });
    expect((await startSpinAction(ROOM_ID, {}, voters(SARAH))).error).toContain("Plus aucune comédie");
  });

  it("turns a database refusal into a readable error", async () => {
    services.startSpin.mockRejectedValue(new Error("violates foreign key"));
    expect((await startSpinAction(ROOM_ID, {}, voters(SARAH))).error).toContain("ça a coincé");
  });

  it("tells the launcher a friend was faster", async () => {
    services.startSpin.mockResolvedValue({ status: "already_voting", spinId: SPIN_ID });
    expect((await startSpinAction(ROOM_ID, {}, voters(SARAH))).error).toContain("vient de lancer la roue");
    expect(refresh).toHaveBeenCalled();
  });

  it("caps the number of voters", async () => {
    const tooMany = Array.from({ length: 51 }, () => SARAH);
    expect((await startSpinAction(ROOM_ID, {}, voters(...tooMany))).error).toBe("Coche au moins une personne présente ce soir.");
  });
});

describe("castVoteAction", () => {
  it("records the vote of the current user", async () => {
    services.castVote.mockResolvedValue({ status: "voted", outcome: "pending" });
    expect(await castVoteAction(ROOM_ID, SPIN_ID, "yes")).toEqual({});
    expect(services.castVote).toHaveBeenCalledWith("db", { spinId: SPIN_ID, roomId: ROOM_ID, userId: "user-1", vote: "yes" });
  });

  it("rejects anything but yes or no", async () => {
    expect((await castVoteAction(ROOM_ID, SPIN_ID, "maybe")).error).toBe("Vote invalide.");
    expect(services.castVote).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "closed" }, "Ce vote est déjà terminé."],
    [{ status: "not_voter" }, "Tu n'étais pas coché pour ce vote."],
    [{ status: "voted", outcome: "tie", nextSpinId: null }, "Plus aucune comédie"],
  ])("explains %j", async (result, message) => {
    services.castVote.mockResolvedValue(result);
    expect((await castVoteAction(ROOM_ID, SPIN_ID, "no")).error).toContain(message);
  });
});

describe("markSeenAction", () => {
  it("removes the film and relaunches", async () => {
    services.markSeenAndRelaunch.mockResolvedValue({ status: "relaunched", spinId: "next" });
    expect(await markSeenAction(ROOM_ID, SPIN_ID)).toEqual({});
    expect(refresh).toHaveBeenCalled();
  });

  it("rejects a malformed spin id", async () => {
    expect((await markSeenAction(ROOM_ID, "nope")).error).toBe("Film invalide.");
  });

  it("refuses members who are not voting tonight", async () => {
    services.markSeenAndRelaunch.mockResolvedValue({ status: "not_voter" });
    expect((await markSeenAction(ROOM_ID, SPIN_ID)).error).toBe("Tu n'étais pas coché pour ce vote.");
  });

  it("reports unexpected failures without crashing the page", async () => {
    services.markSeenAndRelaunch.mockRejectedValue(new Error("db down"));
    expect((await markSeenAction(ROOM_ID, SPIN_ID)).error).toContain("ça a coincé");
  });
});
