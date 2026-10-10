import Link from "next/link";
import { AvatarStack } from "@/components/ui/avatar";
import { plural } from "@/lib/format";
import type { RoomSummary } from "../types";

export function RoomCard({ room }: { room: RoomSummary }) {
  return (
    <Link
      href={`/rooms/${room.id}`}
      className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[18px] shadow-card transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex items-center justify-between gap-2">
        <strong className="text-lg font-bold">{room.name}</strong>
        {room.role === "admin" && (
          <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-ink-soft">Admin</span>
        )}
      </span>
      <span className="flex items-center justify-between gap-3">
        <AvatarStack people={room.previewMembers} />
        <span className="text-[13px] text-muted">
          {plural(room.memberCount, "membre")} · {plural(room.watchedCount, "film vu", "films vus")}
        </span>
      </span>
    </Link>
  );
}
