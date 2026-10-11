import type { LokServerMood } from '@/game/data/lokServer';

/** Outline-and-silhouette owl: dark body, glowing stroke, mood-driven face. */
export function HoloOwl({ mood, className = 'h-28 w-28 sm:h-36 sm:w-36' }: { mood: LokServerMood; className?: string }) {
  const stroke = '#c084fc';
  return (
    <svg viewBox="0 0 120 120" className={`lokshop-owl shrink-0 ${className}`} data-mood={mood} aria-hidden="true" data-testid="lokserver-face">
      <defs>
        <linearGradient id="owl-holo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" stopOpacity=".95" />
          <stop offset="1" stopColor="#020617" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <path d="M22 40 L30 12 L48 30 L72 30 L90 12 L98 40 L98 84 Q98 112 60 112 Q22 112 22 84 Z" fill="url(#owl-holo)" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M34 78 Q60 100 86 78 M40 90 Q60 104 80 90 M46 100 Q60 108 74 100" fill="none" stroke="#67e8f9" strokeOpacity=".55" strokeWidth="1.5" />
      <g className="brow" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"><path d="M30 42 L52 48" /><path d="M90 42 L68 48" /></g>
      {[43, 77].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="58" r="15" fill="#020617" stroke={stroke} strokeWidth="2.5" />
          <g className="eye-lid"><circle cx={cx} cy="58" r="9" fill="#fde047" fillOpacity=".92" /><circle className="pupil" cx={cx} cy="58" r="4" fill="#020617" /></g>
        </g>
      ))}
      <path d="M60 66 L53 79 L67 79 Z" fill="#fb923c" fillOpacity=".9" stroke="#fdba74" strokeWidth="1.5" />
    </svg>
  );
}

