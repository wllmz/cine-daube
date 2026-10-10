export type TomyMood = "content" | "degoute" | "choque";

type TomyProps = {
  mood?: TomyMood;
  size?: number;
  className?: string;
};

type MoodShape = {
  mouth: string;
  mouthFill: string;
  showTongue: boolean;
  showBrows: boolean;
  pupilLeftX: number;
  pupilRightX: number;
  pupilY: number;
};

const MOODS: Record<TomyMood, MoodShape> = {
  content: {
    mouth: "M50 82 Q60 91 70 82",
    mouthFill: "none",
    showTongue: false,
    showBrows: false,
    pupilLeftX: 48,
    pupilRightX: 74,
    pupilY: 67,
  },
  degoute: {
    mouth: "M48 88 Q54 83 60 88 Q66 93 72 87",
    mouthFill: "none",
    showTongue: true,
    showBrows: true,
    pupilLeftX: 45,
    pupilRightX: 71,
    pupilY: 69,
  },
  choque: {
    mouth: "M55 87 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0",
    mouthFill: "#18181B",
    showTongue: false,
    showBrows: false,
    pupilLeftX: 47,
    pupilRightX: 73,
    pupilY: 65,
  },
};

const BLINK = {
  keyTimes: "0;0.9;0.94;0.98;1",
  dur: "4s",
  repeatCount: "indefinite",
} as const;

/** Tomy, the tomato mascot. Animated with SVG SMIL so it works in Server Components. */
export function Tomy({ mood = "content", size = 120, className }: TomyProps) {
  const shape = MOODS[mood];

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label="Tomy, la tomate mascotte de Ciné Daube"
      className={className}
    >
      <ellipse cx="60" cy="113" rx="26" ry="3.5" fill="#18181B" opacity="0.07" />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 0 -4; 0 0"
          dur="2.6s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
        />
        <circle cx="60" cy="68" r="40" fill="#E8553F" />
        <path
          d="M60 108 A40 40 0 0 0 100 68 A40 40 0 0 1 60 98 A40 40 0 0 1 22 76 A40 40 0 0 0 60 108 Z"
          fill="#C9432F"
          opacity="0.35"
        />
        <ellipse
          cx="42"
          cy="50"
          rx="9"
          ry="5"
          fill="#FFFFFF"
          opacity="0.45"
          transform="rotate(-35 42 50)"
        />
        <path d="M60 32 C53 22 44 22 39 27 C47 28 52 31 55 35 Z" fill="#3C9A5F" />
        <path d="M60 32 C67 22 76 22 81 27 C73 28 68 31 65 35 Z" fill="#3C9A5F" />
        <path
          d="M60 33 C59 25 60 19 64 14"
          fill="none"
          stroke="#2E7A4A"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {shape.showBrows && (
          <path
            d="M40 54 L51 57.5 M80 54 L69 57.5"
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        {[47, 73].map((cx) => (
          <ellipse key={cx} cx={cx} cy="66" rx="7" ry="8" fill="#FFFFFF">
            <animate attributeName="ry" values="8;8;0.6;8;8" {...BLINK} />
          </ellipse>
        ))}
        {[shape.pupilLeftX, shape.pupilRightX].map((cx) => (
          <circle key={cx} cx={cx} cy={shape.pupilY} r="3.4" fill="#18181B">
            <animate attributeName="opacity" values="1;1;0;1;1" {...BLINK} />
          </circle>
        ))}
        <circle cx="36" cy="80" r="5" fill="#FFB3A6" opacity="0.6" />
        <circle cx="84" cy="80" r="5" fill="#FFB3A6" opacity="0.6" />
        {shape.showTongue && <path d="M63 88 Q67 97 71 88 Z" fill="#FF9DAF" />}
        <path
          d={shape.mouth}
          fill={shape.mouthFill}
          stroke="#18181B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
