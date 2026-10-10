"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { plural } from "@/lib/format";

type RoomPresence = {
  /** Members with the room open right now. */
  onlineIds: ReadonlySet<string>;
  /** False until the first presence snapshot arrived. */
  ready: boolean;
  currentUserId: string;
};

const RoomPresenceContext = createContext<RoomPresence>({
  onlineIds: new Set(),
  ready: false,
  currentUserId: "",
});

// Several rows change in one action (spin + votes): one refresh is enough.
const REFRESH_DEBOUNCE_MS = 250;

type RoomRealtimeProps = {
  roomId: string;
  currentUserId: string;
  children: ReactNode;
};

/**
 * Joins the room's private Realtime channel: re-renders the page when the
 * database announces a change, and shares who has the room open.
 * The channel only carries "something changed" and presence; data is always
 * re-read through the server, with the usual membership checks.
 * Mounted once in the room layout, so moving between the room's pages keeps
 * a single subscription.
 */
export function RoomRealtime({ roomId, currentUserId, children }: RoomRealtimeProps) {
  const router = useRouter();
  const [presence, setPresence] = useState<Omit<RoomPresence, "currentUserId">>({
    onlineIds: new Set(),
    ready: false,
  });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const topic = `room:${roomId}`;
    let refreshTimer: number | undefined;
    let cancelled = false;
    let subscribedOnce = false;

    const refreshSoon = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    // realtime-js hands back an existing channel for the same topic, even one
    // still leaving after a quick navigation: subscribing to it does nothing.
    // Remove any leftover first, then open a fresh channel.
    const leftovers = supabase.getChannels().filter((channel) => channel.subTopic === topic);
    const channelPromise = Promise.all(leftovers.map((channel) => supabase.removeChannel(channel))).then(() => {
      if (cancelled) return null;
      const channel = supabase.channel(topic, {
        config: { private: true, presence: { key: currentUserId, enabled: true } },
      });
      channel
        .on("broadcast", { event: "room_changed" }, refreshSoon)
        .on("presence", { event: "sync" }, () => {
          setPresence({ onlineIds: new Set(Object.keys(channel.presenceState())), ready: true });
        })
        .subscribe((status, error) => {
          if (status === "SUBSCRIBED") {
            void channel.track({ online_at: new Date().toISOString() });
            // After a reconnection, catch up on changes broadcast meanwhile.
            if (subscribedOnce) refreshSoon();
            subscribedOnce = true;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Usually an authorisation problem: the 30s poll keeps the page usable.
            console.warn(`Realtime ${topic}: ${status}`, error);
          }
        });
      return channel;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      void channelPromise.then((channel) => channel && supabase.removeChannel(channel));
    };
  }, [roomId, currentUserId, router]);

  return <RoomPresenceContext value={{ ...presence, currentUserId }}>{children}</RoomPresenceContext>;
}

export function useRoomPresence(): RoomPresence {
  return use(RoomPresenceContext);
}

/** "2 en ligne sur 4", for a quick glance. */
export function OnlineCount({ total }: { total: number }) {
  const { onlineIds, ready } = useRoomPresence();

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      {ready && <span aria-hidden="true" className="size-2 rounded-full bg-success" />}
      {ready ? `${onlineIds.size} en ligne sur ${total}` : plural(total, "membre")}
    </span>
  );
}
