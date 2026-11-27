import { useGameMode } from '@/lib/gameMode';
import { useT } from '@/lib/i18n';

/**
 * The shared Game Mode switch for every Lok screen. Original corner-bracket art: the brackets
 * pull outward when the screen is free and snap inward while Game Mode is on. Reacts on
 * pointerdown, never takes keyboard focus (tabIndex -1) so arrow keys always reach the game, and
 * hides itself where the browser has no Fullscreen API.
 */
export function GameModeButton({ className = '', tone = 'dark' }: { className?: string; tone?: 'dark' | 'cream' }) {
  const t = useT();
  const mode = useGameMode();
  if (!mode.supported) return null;
  const ink = tone === 'cream' ? '#3b2a20' : '#faf6ee';
  const bg = tone === 'cream' ? '#faf6ee' : 'rgba(7,6,26,0.78)';
  const inset = mode.active ? 5 : 2;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={t('gameMode.aria')}
      aria-pressed={mode.active}
      data-testid="button-game-mode"
      onPointerDown={(e) => {
        e.preventDefault();
        void mode.toggle();
      }}
      className={`flex items-center gap-2 rounded-full border-[3px] px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-transform active:translate-y-[2px] active:scale-95 ${className}`}
      style={{ background: bg, borderColor: ink, color: ink, boxShadow: tone === 'cream' ? '0 3px 0 #3b2a20' : '0 0 14px rgba(56,242,255,0.35)', touchAction: 'none' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ transition: 'all 160ms ease-out' }}>
        <g fill="none" stroke={mode.active ? '#7cff6b' : ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M${inset} 6.5 V${inset} H6.5`} />
          <path d={`M11.5 ${inset} H${18 - inset} V6.5`} />
          <path d={`M${18 - inset} 11.5 V${18 - inset} H11.5`} />
          <path d={`M6.5 ${18 - inset} H${inset} V11.5`} />
        </g>
        <circle cx="9" cy="9" r={mode.active ? 2.6 : 1.4} fill={mode.active ? '#7cff6b' : ink} style={{ transition: 'all 160ms ease-out' }} />
      </svg>
      <span>{mode.active ? t('gameMode.exit') : t('gameMode.enter')}</span>
      {mode.active ? <span className="hidden text-[10px] font-bold normal-case opacity-70 sm:inline">{t('gameMode.hint')}</span> : null}
    </button>
  );
}
