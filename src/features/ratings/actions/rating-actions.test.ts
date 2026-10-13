// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const ROOM_ID = "6f1c2c5e-8a5b-4c1e-9a7e-2f3d4b5c6d7e";
const saveRating = vi.fn();

vi.mock("@/db", () => ({ getDb: () => "db" }));
vi.mock("@/features/auth/server", () => ({ getCurrentUser: async () => ({ id: "user-1" }) }));
vi.mock("@/features/rooms/server", () => ({ requireRoomMember: async (id: string) => ({ id }) }));
vi.mock("../services/rating-service", () => ({ saveRating }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectSignal(path);
  },
}));

class RedirectSignal extends Error {
  constructor(public readonly path: string) {
    super(`redirect:${path}`);
  }
}

const { rateMovieAction } = await import("./rating-actions");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}

async function redirectPathOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((caught: unknown) => caught);
  if (!(error instanceof RedirectSignal)) throw new Error("Expected a redirect");
  return error.path;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("rateMovieAction", () => {
  it("saves the scores with the bonus and opens the film", async () => {
    const path = await redirectPathOf(
      rateMovieAction(ROOM_ID, "42", {}, form({ humour: "3", scenario: "2", actingEnabled: "on", acting: "6" })),
    );
    expect(saveRating).toHaveBeenCalledWith("db", {
      roomId: ROOM_ID,
      movieId: 42,
      userId: "user-1",
      scores: { humour: 3, scenario: 2, acting: 6 },
    });
    expect(path).toBe(`/rooms/${ROOM_ID}/movies/42`);
  });

  it("ignores the bonus slider when its checkbox is off", async () => {
    await redirectPathOf(rateMovieAction(ROOM_ID, "42", {}, form({ humour: "3", scenario: "2", acting: "6" })));
    expect(saveRating.mock.calls[0]?.[1].scores).toEqual({ humour: 3, scenario: 2, acting: null });
  });

  it.each([
    ["a score above 10", { humour: "11", scenario: "2" }],
    ["a missing score", { humour: "3" }],
    ["an empty score (not a zero)", { humour: "", scenario: "2" }],
    ["an empty bonus when ticked", { humour: "3", scenario: "2", actingEnabled: "on", acting: "" }],
    ["a missing bonus when ticked", { humour: "3", scenario: "2", actingEnabled: "on" }],
    ["a padded score", { humour: " 4", scenario: "2" }],
    ["a decimal score", { humour: "3.5", scenario: "2" }],
    ["an exponent", { humour: "1e1", scenario: "2" }],
  ])("rejects %s", async (_label, fields) => {
    expect((await rateMovieAction(ROOM_ID, "42", {}, form(fields))).error).toBe("Les notes vont de 0 à 10.");
    expect(saveRating).not.toHaveBeenCalled();
  });

  it.each(["abc", "1e3", " 42", "042", "0"])("rejects the film id %j", async (movieId) => {
    expect((await rateMovieAction(ROOM_ID, movieId, {}, form({ humour: "3", scenario: "2" }))).error).toBe(
      "Film introuvable.",
    );
    expect(saveRating).not.toHaveBeenCalled();
  });

  it("accepts a real zero", async () => {
    await redirectPathOf(rateMovieAction(ROOM_ID, "42", {}, form({ humour: "0", scenario: "0" })));
    expect(saveRating.mock.calls[0]?.[1].scores).toEqual({ humour: 0, scenario: 0, acting: null });
  });

  it("explains a film the room did not watch", async () => {
    saveRating.mockRejectedValue({ code: "23503", constraint_name: "ratings_room_movie_fk" });
    expect((await rateMovieAction(ROOM_ID, "42", {}, form({ humour: "3", scenario: "2" }))).error).toContain(
      "Impossible d'enregistrer",
    );
  });

  it("lets other database failures surface", async () => {
    const outage = new Error("connection terminated");
    saveRating.mockRejectedValue(outage);
    await expect(rateMovieAction(ROOM_ID, "42", {}, form({ humour: "3", scenario: "2" }))).rejects.toBe(outage);
  });
});
