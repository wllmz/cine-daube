import Link from "next/link";
import { cn } from "@/lib/utils";

/** "Soirée / Films vus / Classement" switch between the room's sections. */
export function RoomTabs({ roomId, active }: { roomId: string; active: "lobby" | "movies" | "leaderboard" }) {
  const tabs = [
    { key: "lobby", href: `/rooms/${roomId}`, label: "Soirée" },
    { key: "movies", href: `/rooms/${roomId}/movies`, label: "Films vus" },
    { key: "leaderboard", href: `/rooms/${roomId}/leaderboard`, label: "Classement" },
  ] as const;

  return (
    <nav aria-label="Sections de la room" className="grid grid-cols-3 gap-1 rounded-xl bg-chip p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "flex h-10 min-w-0 items-center justify-center rounded-[9px] px-1 text-[13px] font-semibold whitespace-nowrap transition sm:text-sm",
            tab.key === active ? "bg-surface text-ink shadow-[0_1px_3px_rgb(24_24_27/0.1)]" : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
