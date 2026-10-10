// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const services = {
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  regenerateInviteCode: vi.fn(),
};
const refresh = vi.fn();

vi.mock("@/db", () => ({ getDb: () => "db" }));
vi.mock("@/features/auth/server", () => ({
  getCurrentUser: async () => ({ id: "user-1", email: "will@example.fr", pseudo: "Will" }),
}));
vi.mock("../services/room-service", () => services);
vi.mock("next/cache", () => ({ refresh }));
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

const { createRoomAction, joinRoomAction, regenerateInviteAction } = await import("./room-actions");

const ROOM_ID = "6f1c2c5e-8a5b-4c1e-9a7e-2f3d4b5c6d7e";

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
});

describe("createRoomAction", () => {
  it("creates the room for the current user and opens the invite screen", async () => {
    services.createRoom.mockResolvedValue({ id: ROOM_ID });
    const path = await redirectPathOf(createRoomAction({}, form({ name: "  Les Nanardeurs " })));
    expect(services.createRoom).toHaveBeenCalledWith("db", { userId: "user-1", name: "Les Nanardeurs" });
    expect(path).toBe(`/rooms/${ROOM_ID}/invite`);
  });

  it("rejects an empty name", async () => {
    const state = await createRoomAction({}, form({ name: "   " }));
    expect(state.fieldErrors?.name).toBe("Donne un nom à ta room.");
    expect(services.createRoom).not.toHaveBeenCalled();
  });
});

describe("joinRoomAction", () => {
  it("normalises the code and opens the room", async () => {
    services.joinRoom.mockResolvedValue({ status: "joined", roomId: ROOM_ID });
    const path = await redirectPathOf(joinRoomAction({}, form({ code: "daube-7k2qxm" })));
    expect(services.joinRoom).toHaveBeenCalledWith("db", { userId: "user-1", code: "7K2QXM" });
    expect(path).toBe(`/rooms/${ROOM_ID}`);
  });

  it.each([
    ["not_found", "Aucune room avec ce code"],
    ["expired", "Ce code a expiré"],
  ])("explains a %s code", async (status, message) => {
    services.joinRoom.mockResolvedValue({ status });
    const state = await joinRoomAction({}, form({ code: "7K2QXM" }));
    expect(state.error).toContain(message);
    expect(state.values?.code).toBe("7K2QXM");
  });

  it("rejects something that cannot be a code without querying", async () => {
    const state = await joinRoomAction({}, form({ code: "salut" }));
    expect(state.fieldErrors?.code).toBe("Ce code ne ressemble pas à une invitation.");
    expect(services.joinRoom).not.toHaveBeenCalled();
  });
});

describe("regenerateInviteAction", () => {
  it("refreshes the page once the code changed", async () => {
    services.regenerateInviteCode.mockResolvedValue({ inviteCode: "CCCCCC" });
    expect(await regenerateInviteAction(ROOM_ID)).toEqual({});
    expect(services.regenerateInviteCode).toHaveBeenCalledWith("db", { roomId: ROOM_ID, userId: "user-1" });
    expect(refresh).toHaveBeenCalled();
  });

  it("explains why a non-admin cannot do it", async () => {
    services.regenerateInviteCode.mockResolvedValue(null);
    expect((await regenerateInviteAction(ROOM_ID)).error).toBe("Seul l'admin de la room peut changer le code.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects a malformed room id", async () => {
    expect((await regenerateInviteAction("../../etc")).error).toBe("Room introuvable.");
    expect(services.regenerateInviteCode).not.toHaveBeenCalled();
  });
});
