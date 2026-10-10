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
    ["a score above 10", { humour: "11", scenario: "2" }, "42"],
    ["a missing score", { humour: "3" }, "42"],
    ["a decimal score", { humour: "3.5", scenario: "2" }, "42"],
    ["a malformed film id", { humour: "3", scenario: "2" }, "abc"],
  ])("rejects %s", async (_label, fields, movieId) => {
    expect((await rateMovieAction(ROOM_ID, movieId, {}, form(fields))).error).toBe("Les notes vont de 0 à 10.");
    expect(saveRating).not.toHaveBeenCalled();
  });

  it("explains a film the room did not watch", async () => {
    saveRating.mockRejectedValue(new Error("violates foreign key"));
    expect((await rateMovieAction(ROOM_ID, "42", {}, form({ humour: "3", scenario: "2" }))).error).toContain(
      "Impossible d'enregistrer",
    );
  });
});
