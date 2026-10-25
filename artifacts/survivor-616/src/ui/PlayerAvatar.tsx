import { useState } from 'react';

import { hueOf, initialsOf, safeAvatarUrl } from '@/lib/social/identity';

/** A player's picture (only from the sign-in providers' own hosts) or, failing that, coloured initials. */
export function PlayerAvatar({ name, src, size = 40, online }: { name: string; src?: string | null; size?: number; online?: boolean }) {
  const [broken, setBroken] = useState(false);
  const safe = safeAvatarUrl(src);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {safe && !broken ? (
        <img src={safe} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full rounded-full border border-white/20 object-cover" />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full border border-white/20 font-black text-white"
          style={{ background: `hsl(${hueOf(name)} 45% 32%)`, fontSize: Math.max(10, size * 0.38) }}
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
      )}
      {online !== undefined ? (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${online ? 'bg-emerald-400' : 'bg-slate-600'}`} aria-hidden="true" />
      ) : null}
    </span>
  );
}
