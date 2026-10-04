/**
 * Konami-code easter egg for the title screen: a drift of fireflies lights up
 * the intro for a few seconds. Pure flavor, no mechanical effect, and it
 * respects reduced-motion by holding the dots still.
 */
import { useEffect, useMemo, useState } from 'react';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SHOW_MS = 9000;

export function FireflyEasterEgg() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let progress = 0;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      progress = key === KONAMI[progress] ? progress + 1 : key === KONAMI[0] ? 1 : 0;
      if (progress === KONAMI.length) {
        progress = 0;
        setActive(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setActive(false), SHOW_MS);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const flies = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        delay: (i % 7) * 0.4,
        duration: 3 + (i % 5) * 0.7,
        size: 4 + (i % 3) * 2,
      })),
    [],
  );

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true" data-testid="easter-egg-fireflies">
      <style>{`
        @keyframes firefly-drift { 0%,100% { transform: translate(0,0); opacity: .2 } 50% { transform: translate(18px,-26px); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .easter-firefly { animation: none !important; opacity: .8 !important } }
      `}</style>
      {flies.map((fly) => (
        <span
          key={fly.id}
          className="easter-firefly absolute rounded-full bg-amber-200"
          style={{
            left: `${fly.left}%`,
            top: `${fly.top}%`,
            width: fly.size,
            height: fly.size,
            boxShadow: '0 0 12px 4px rgba(253, 224, 71, 0.65)',
            animation: `firefly-drift ${fly.duration}s ease-in-out ${fly.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
