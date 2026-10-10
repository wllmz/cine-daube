import { Tomy, type TomyMood } from "@/components/ui/tomy";
import { cn } from "@/lib/utils";

const SEGMENTS =
  "conic-gradient(#cf3e2a 0deg 45deg, #fdf0ee 45deg 90deg, #f08c78 90deg 135deg, #fdf0ee 135deg 180deg, #cf3e2a 180deg 225deg, #fdf0ee 225deg 270deg, #f08c78 270deg 315deg, #fdf0ee 315deg 360deg)";

type RouletteWheelProps = {
  spinning?: boolean;
  mood?: TomyMood;
  size?: number;
};

/** The wheel from the mockups. Purely decorative: the draw happens on the server. */
export function RouletteWheel({ spinning = false, mood = "content", size = 260 }: RouletteWheelProps) {
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <svg
        width="28"
        height="34"
        viewBox="0 0 28 34"
        className={cn("absolute -top-3 left-1/2 z-10 -translate-x-1/2 drop-shadow", spinning && "animate-tick")}
      >
        <path d="M3 4 Q3 2 5 2 H23 Q25 2 25 4 L15.5 30 Q14 33 12.5 30 Z" fill="#18181B" />
      </svg>
      <div
        className={cn(
          "size-full rounded-full border-8 border-surface shadow-[0_0_0_1px_var(--color-line),0_16px_40px_rgb(24_24_27/0.1)]",
          spinning && "animate-wheel-spin",
        )}
        style={{ background: SEGMENTS }}
      />
      <div className="absolute top-1/2 left-1/2 flex size-[38%] -translate-1/2 items-center justify-center rounded-full bg-surface shadow-[0_6px_18px_rgb(24_24_27/0.14)]">
        <Tomy mood={spinning ? "choque" : mood} size={Math.round(size * 0.3)} />
      </div>
    </div>
  );
}
