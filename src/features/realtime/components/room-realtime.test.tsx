import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = () => void;
type StatusCallback = (status: string, error?: Error) => void;

/** A fake channel that lets each test drive subscription and presence. */
function fakeChannel(subTopic: string) {
  const handlers: Record<string, Handler> = {};
  const channel = {
    subTopic,
    presence: {} as Record<string, unknown[]>,
    statusCallback: undefined as StatusCallback | undefined,
    on: vi.fn((type: string, filter: { event: string }, handler: Handler) => {
      handlers[`${type}:${filter.event}`] = handler;
      return channel;
    }),
    subscribe: vi.fn((callback: StatusCallback) => {
      channel.statusCallback = callback;
      return channel;
    }),
    track: vi.fn(async () => "ok"),
    presenceState: () => channel.presence,
    emit: (key: string) => handlers[key]?.(),
  };
  return channel;
}

type FakeChannel = ReturnType<typeof fakeChannel>;

let channels: FakeChannel[] = [];
const supabase = {
  getChannels: vi.fn(() => channels),
  channel: vi.fn((topic: string) => {
    const channel = fakeChannel(topic);
    channels.push(channel);
    return channel;
  }),
  removeChannel: vi.fn(async (channel: FakeChannel) => {
    channels = channels.filter((c) => c !== channel);
    return "ok";
  }),
};
const refresh = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => supabase }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { OnlineCount, RoomRealtime } = await import("./room-realtime");

async function renderRoom() {
  const result = render(
    <RoomRealtime roomId="room-1" currentUserId="will">
      <OnlineCount total={4} />
    </RoomRealtime>,
  );
  await act(async () => {});
  const channel = channels.at(-1);
  if (!channel) throw new Error("no channel opened");
  return { ...result, channel };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  channels = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomRealtime", () => {
  it("joins the room's private channel and tracks presence once subscribed", async () => {
    const { channel } = await renderRoom();

    expect(supabase.channel).toHaveBeenCalledWith("room:room-1", {
      config: { private: true, presence: { key: "will", enabled: true } },
    });
    expect(channel.track).not.toHaveBeenCalled();
    act(() => channel.statusCallback?.("SUBSCRIBED"));
    expect(channel.track).toHaveBeenCalled();
  });

  it("removes a leftover channel of the same room before opening a new one", async () => {
    const leaving = fakeChannel("room:room-1");
    channels = [leaving];

    const { channel } = await renderRoom();

    expect(supabase.removeChannel).toHaveBeenCalledWith(leaving);
    expect(channel).not.toBe(leaving);
  });

  it("refreshes the page once for a burst of database changes", async () => {
    const { channel } = await renderRoom();
    act(() => {
      channel.emit("broadcast:room_changed");
      channel.emit("broadcast:room_changed");
      channel.emit("broadcast:room_changed");
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("catches up after a reconnection, not on the first subscription", async () => {
    const { channel } = await renderRoom();
    act(() => {
      channel.statusCallback?.("SUBSCRIBED");
      vi.advanceTimersByTime(300);
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      channel.statusCallback?.("SUBSCRIBED");
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reports channel errors instead of failing silently", async () => {
    const { channel } = await renderRoom();
    act(() => channel.statusCallback?.("CHANNEL_ERROR", new Error("unauthorized")));
    expect(console.warn).toHaveBeenCalledWith("Realtime room:room-1: CHANNEL_ERROR", expect.any(Error));
  });

  it("shows who is online once presence is known", async () => {
    const { channel } = await renderRoom();
    expect(screen.getByText("4 membres")).toBeTruthy();

    channel.presence = { will: [{}], sarah: [{}] };
    act(() => channel.emit("presence:sync"));
    expect(screen.getByText("2 en ligne sur 4")).toBeTruthy();
  });

  it("leaves the channel when the room is closed", async () => {
    const { unmount, channel } = await renderRoom();
    unmount();
    await act(async () => {});
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
