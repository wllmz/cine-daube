import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = () => void;

const handlers: Record<string, Handler> = {};
let presence: Record<string, unknown[]> = {};
const channel = {
  on: vi.fn((type: string, filter: { event: string }, handler: Handler) => {
    handlers[`${type}:${filter.event}`] = handler;
    return channel;
  }),
  subscribe: vi.fn((callback: (status: string) => void) => {
    callback("SUBSCRIBED");
    return channel;
  }),
  track: vi.fn(async () => "ok"),
  presenceState: () => presence,
};
const supabase = {
  channel: vi.fn(() => channel),
  removeChannel: vi.fn(async () => "ok"),
  realtime: { setAuth: vi.fn(async () => undefined) },
};
const refresh = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => supabase }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { OnlineCount, RoomRealtime } = await import("./room-realtime");

function renderRoom() {
  return render(
    <RoomRealtime roomId="room-1" currentUserId="will">
      <OnlineCount total={4} />
    </RoomRealtime>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  presence = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RoomRealtime", () => {
  it("joins the room's private channel and announces its presence", async () => {
    renderRoom();
    await act(async () => {});

    expect(supabase.channel).toHaveBeenCalledWith("room:room-1", {
      config: { private: true, presence: { key: "will", enabled: true } },
    });
    expect(supabase.realtime.setAuth).toHaveBeenCalled();
    expect(channel.track).toHaveBeenCalled();
  });

  it("refreshes the page once for a burst of database changes", async () => {
    renderRoom();
    await act(async () => {});

    act(() => {
      handlers["broadcast:room_changed"]?.();
      handlers["broadcast:room_changed"]?.();
      handlers["broadcast:room_changed"]?.();
      vi.advanceTimersByTime(300);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows who is online once presence is known", async () => {
    renderRoom();
    await act(async () => {});
    expect(screen.getByText("4 membres")).toBeTruthy();

    presence = { will: [{}], sarah: [{}] };
    act(() => handlers["presence:sync"]?.());
    expect(screen.getByText("2 en ligne sur 4")).toBeTruthy();
  });

  it("leaves the channel when the page closes", async () => {
    const { unmount } = renderRoom();
    await act(async () => {});
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
