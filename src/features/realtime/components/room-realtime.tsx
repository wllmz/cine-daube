"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type RoomPresence = {
  /** Members with the room open right now (this tab included once tracked). */
  onlineIds: ReadonlySet<string>;
  /** False until the first presence snapshot arrived. */
  ready: boolean;
};

const RoomPresenceContext = createContext<RoomPresence>({ onlineIds: new Set(), ready: false });

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
 */
export function RoomRealtime({ roomId, currentUserId, children }: RoomRealtimeProps) {
  const router = useRouter();
  const [presence, setPresence] = useState<RoomPresence>({ onlineIds: new Set(), ready: false });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: number | undefined;
    let cancelled = false;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { private: true, presence: { key: currentUserId, enabled: true } },
    });

    channel
      .on("broadcast", { event: "room_changed" }, () => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
      })
      .on("presence", { event: "sync" }, () => {
        setPresence({ onlineIds: new Set(Object.keys(channel.presenceState())), ready: true });
      });

    // Private channels authorise with the user's session token.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ online_at: new Date().toISOString() });
      });
    });

    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, router]);

  return <RoomPresenceContext value={presence}>{children}</RoomPresenceContext>;
}

export function useRoomPresence(): RoomPresence {
  return use(RoomPresenceContext);
}

/** "3 en ligne", for a quick glance. */
export function OnlineCount({ total }: { total: number }) {
  const { onlineIds, ready } = useRoomPresence();
  const label = useMemo(() => {
    if (!ready) return `${total} membre${total > 1 ? "s" : ""}`;
    return `${onlineIds.size} en ligne sur ${total}`;
  }, [onlineIds, ready, total]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      {ready && <span aria-hidden="true" className="size-2 rounded-full bg-success" />}
      {label}
    </span>
  );
}
