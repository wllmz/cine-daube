import { Avatar } from "@/components/ui/avatar";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "../types";

const PODIUM: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** The room's ranking: points from validated predictions, over every film. */
export function LeaderboardList({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((entry) => {
        const isMe = entry.userId === currentUserId;
        return (
          <li
            key={entry.userId}
            className={cn("flex items-center gap-3 rounded-[16px] px-3 py-2.5", isMe ? "bg-accent-soft" : "bg-subtle")}
          >
            <span className="w-7 text-center text-base font-extrabold" aria-label={`${entry.rank}e`}>
              {entry.points > 0 && PODIUM[entry.rank] ? PODIUM[entry.rank] : entry.rank}
            </span>
            <Avatar id={entry.userId} pseudo={entry.pseudo} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-[15px] font-bold" aria-hidden="true">
                {entry.pseudo}
                {isMe && <span className="font-semibold text-muted"> · toi</span>}
              </strong>
              <span className="text-xs text-muted">
                {entry.judged > 0
                  ? `${entry.points} juste${entry.points > 1 ? "s" : ""} sur ${plural(entry.judged, "prédiction")}`
                  : "Aucune prédiction jugée"}
              </span>
            </span>
            <span className="text-right">
              <strong className="text-xl font-extrabold text-accent">{entry.points}</strong>
              <span className="text-xs font-semibold text-muted"> pt{entry.points > 1 ? "s" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
