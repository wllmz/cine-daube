import { cn } from "@/lib/utils";

// Pastel backgrounds from the mockups; ink text stays readable on all of them.
const COLORS = ["bg-[#FFE9B8]", "bg-[#FAD4CD]", "bg-[#D5EDDD]", "bg-[#DDE2F7]"] as const;

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0];
}

type AvatarProps = {
  id: string;
  pseudo: string;
  size?: "sm" | "md";
  className?: string;
};

/** Initial on a pastel disc; the colour is stable for a given user. */
export function Avatar({ id, pseudo, size = "md", className }: AvatarProps) {
  return (
    <span
      title={pseudo}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink",
        size === "sm" ? "size-8 text-xs" : "size-[38px] text-sm",
        colorFor(id),
        className,
      )}
    >
      <span aria-hidden="true">{pseudo.charAt(0).toUpperCase()}</span>
      <span className="sr-only">{pseudo}</span>
    </span>
  );
}

export function AvatarStack({ people }: { people: { id: string; pseudo: string }[] }) {
  return (
    <span className="flex">
      {people.map((person, index) => (
        <Avatar
          key={person.id}
          {...person}
          size="sm"
          className={cn("ring-2 ring-surface", index > 0 && "-ml-2")}
        />
      ))}
    </span>
  );
}
