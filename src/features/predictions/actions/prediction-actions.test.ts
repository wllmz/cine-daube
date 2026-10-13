// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "6f1c2c5e-8a5b-4c1e-9a7e-2f3d4b5c6d7e";
const PROPOSAL_ID = "7a2d3c4b-5e6f-4a1b-8c9d-0e1f2a3b4c5d";
const service = {
  addPrediction: vi.fn(),
  deletePrediction: vi.fn(),
  proposeFinish: vi.fn(),
  castFinishVote: vi.fn(),
};
const judging = { castPredictionVote: vi.fn() };

vi.mock("@/db", () => ({ getDb: () => "db" }));
vi.mock("@/features/auth/server", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/features/rooms/server", () => ({ requireRoomMember: async (id: string) => ({ id }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("../services/prediction-service", () => service);
vi.mock("../services/judging-service", () => judging);

const {
  addPredictionAction,
  castFinishVoteAction,
  castPredictionVoteAction,
  deletePredictionAction,
  proposeFinishAction,
} = await import("./prediction-actions");

function form(content?: string): FormData {
  const data = new FormData();
  if (content !== undefined) data.set("content", content);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addPredictionAction", () => {
  it("saves the trimmed prediction for the current member", async () => {
    service.addPrediction.mockResolvedValue({ status: "added" });
    expect(await addPredictionAction(ROOM_ID, 42, {}, form("  Clavier crie  "))).toEqual({});
    expect(service.addPrediction).toHaveBeenCalledWith("db", {
      roomId: ROOM_ID,
      movieId: 42,
      userId: "user-1",
      content: "Clavier crie",
    });
  });

  it.each([
    ["an empty prediction", "   ", "Écris ta prédiction."],
    ["a missing field", undefined, "Écris ta prédiction."],
    ["a too long prediction", "x".repeat(141), "140 caractères maximum."],
  ])("rejects %s", async (_label, content, message) => {
    expect((await addPredictionAction(ROOM_ID, 42, {}, form(content))).error).toBe(message);
    expect(service.addPrediction).not.toHaveBeenCalled();
  });

  it.each([
    ["limit_reached", "10 prédictions maximum"],
    ["finished", "les prédictions sont fermées"],
    ["not_participant", "Seuls ceux qui ont voté"],
    ["not_found", "Film introuvable"],
  ])("explains %s", async (status, message) => {
    service.addPrediction.mockResolvedValue({ status });
    expect((await addPredictionAction(ROOM_ID, 42, {}, form("Piscine"))).error).toContain(message);
  });

  it("lets database failures surface", async () => {
    const outage = new Error("connection terminated");
    service.addPrediction.mockRejectedValue(outage);
    await expect(addPredictionAction(ROOM_ID, 42, {}, form("Piscine"))).rejects.toBe(outage);
  });
});

describe("deletePredictionAction", () => {
  it("rejects an invalid id without touching the database", async () => {
    expect((await deletePredictionAction(ROOM_ID, 42, "nope")).error).toBe("Film introuvable.");
    expect(service.deletePrediction).not.toHaveBeenCalled();
  });
});

describe("finish vote actions", () => {
  it("opens a vote for the current member", async () => {
    service.proposeFinish.mockResolvedValue({ status: "proposed", proposalId: PROPOSAL_ID, outcome: "pending" });
    expect(await proposeFinishAction(ROOM_ID, 42)).toEqual({});
    expect(service.proposeFinish).toHaveBeenCalledWith("db", { roomId: ROOM_ID, movieId: 42, userId: "user-1" });
  });

  it("only accepts yes or no", async () => {
    expect((await castFinishVoteAction(ROOM_ID, PROPOSAL_ID, "maybe")).error).toBe("Vote invalide.");
    expect(service.castFinishVote).not.toHaveBeenCalled();
  });

  it("tells a late voter the vote is over", async () => {
    service.castFinishVote.mockResolvedValue({ status: "closed" });
    expect((await castFinishVoteAction(ROOM_ID, PROPOSAL_ID, "yes")).error).toBe("Ce vote est déjà terminé.");
  });
});

describe("castPredictionVoteAction", () => {
  it("records the current member's verdict", async () => {
    judging.castPredictionVote.mockResolvedValue({ status: "voted", verdict: "pending" });
    expect(await castPredictionVoteAction(ROOM_ID, PROPOSAL_ID, "yes")).toEqual({});
    expect(judging.castPredictionVote).toHaveBeenCalledWith("db", {
      roomId: ROOM_ID,
      predictionId: PROPOSAL_ID,
      userId: "user-1",
      vote: "yes",
    });
  });

  it.each([
    ["own_prediction", "tes propres prédictions"],
    ["closed", "sont terminés"],
    ["not_finished", "Attends la fin du film"],
  ])("explains %s", async (status, message) => {
    judging.castPredictionVote.mockResolvedValue({ status });
    expect((await castPredictionVoteAction(ROOM_ID, PROPOSAL_ID, "no")).error).toContain(message);
  });

  it("rejects an invalid id or vote", async () => {
    expect((await castPredictionVoteAction(ROOM_ID, "nope", "yes")).error).toBe("Vote invalide.");
    expect((await castPredictionVoteAction(ROOM_ID, PROPOSAL_ID, "peut-être")).error).toBe("Vote invalide.");
    expect(judging.castPredictionVote).not.toHaveBeenCalled();
  });
});
