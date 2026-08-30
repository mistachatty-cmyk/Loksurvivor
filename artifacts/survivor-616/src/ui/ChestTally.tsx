import { useEffect, useState } from 'react';

interface ChestTallyProps {
  count: number;
}

/** Small HUD bubble tracking loot chests collected this run; alternates between the chest glyph and the running count. */
export function ChestTally({ count }: ChestTallyProps) {
  const [showCount, setShowCount] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setShowCount((v) => !v), 1800);
    return () => window.clearInterval(t);
  }, []);

  if (count <= 0) return null;

  return (
    <div
      className="absolute bottom-3 right-28 z-30 flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
      style={{
        borderColor: '#d4af37',
        background: 'radial-gradient(circle at 35% 30%, #7a4a26, #4a2c14 70%)',
        boxShadow: '0 0 0 1px rgba(212,175,55,0.35) inset, 0 0 10px rgba(0,0,0,0.5)',
      }}
      data-testid="indicator-chest-tally"
      title={`${count} chest${count === 1 ? '' : 's'} collected`}
    >
      <span
        key={showCount ? 'count' : 'icon'}
        className="font-mono text-xs font-bold text-[#ffe9b0] transition-all duration-300"
        style={{ animation: 'chest-tally-pop 300ms ease-out' }}
      >
        {showCount ? count : <ChestGlyph />}
      </span>
      <style>{`
        @keyframes chest-tally-pop {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function ChestGlyph() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
      <rect x="1" y="6" width="20" height="11" rx="1.5" fill="#8a5a2e" stroke="#d4af37" strokeWidth="1.4" />
      <rect x="1" y="1" width="20" height="6" rx="1.5" fill="#6b4423" stroke="#d4af37" strokeWidth="1.4" />
      <rect x="9.5" y="6" width="3" height="4" fill="#d4af37" />
    </svg>
  );
}

export default ChestTally;
