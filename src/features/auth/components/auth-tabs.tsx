import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/login", label: "Connexion" },
  { href: "/signup", label: "Inscription" },
] as const;

export function AuthTabs({ active }: { active: "/login" | "/signup" }) {
  return (
    <nav aria-label="Connexion ou inscription" className="grid grid-cols-2 gap-1 rounded-xl bg-chip p-1">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-[42px] items-center justify-center rounded-[9px] text-sm font-semibold transition",
              isActive ? "bg-surface text-ink shadow-[0_1px_3px_rgb(24_24_27/0.1)]" : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
