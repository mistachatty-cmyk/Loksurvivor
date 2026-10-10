/**
 * Foil material and the Retro Neon pack for the Lock Pack Counter. Metal, holo,
 * kraft and stock wraps share the Fighter Print frame (PrintedPack in
 * CardCosmetics.tsx) and only swap the material; Retro Neon is the one special
 * layout. Drawn at the 190 x 304 design size and scaled by <FluidScaled>.
 *
 * Foil is a real crinkle, not a gradient: an SVG turbulence map lit by a point
 * light. On a Live wrap with motion "full" the light drifts across the wrap; otherwise it is
 * fixed, so a shelf of packs costs one paint each. The fighter art and the
 * walkers come in as `art` / `walkers` from CardCosmetics so every figure is a
 * real in-game rig.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';

import type { CardMotion, WrapFinish } from '@/game/data/cardCosmetics';
import type { PurchasableCardPack } from '@/game/data/passiveCards';

export interface MetalDef {
  name: string;
  base: string;
  light: string;
  ink: string;
  edge: string;
  surface: number;
  specular: number;
  exponent: number;
  freq: string;
  seed: number;
}

export const METALS: Record<WrapFinish, MetalDef> = {
  gold: { name: 'Gilt Foil', base: 'linear-gradient(115deg,#6b4a0a,#e8c35a 25%,#fff0a8 40%,#b9872a 58%,#f1cf6a 78%,#6b4a0a)', light: '#fff3c0', ink: '#3f2b05', edge: '#8a6218', surface: 6, specular: 1.1, exponent: 24, freq: '0.012 0.045', seed: 3 },
  platinum: { name: 'Platinum Chrome', base: 'linear-gradient(115deg,#6f7883,#f3f6f9 25%,#a5afbb 42%,#ffffff 56%,#7a8490 78%,#c6ced8)', light: '#ffffff', ink: '#20262d', edge: '#5b6571', surface: 5, specular: 1.3, exponent: 30, freq: '0.010 0.050', seed: 7 },
  bronze: { name: 'Foundry Bronze', base: 'linear-gradient(125deg,#3d2110,#a8673a 32%,#dca06f 48%,#8a4b22 72%,#3d2110)', light: '#ffd9b0', ink: '#fbe9d6', edge: '#2a160a', surface: 7, specular: 0.9, exponent: 18, freq: '0.015 0.040', seed: 11 },
  holo: { name: 'Prism Holo', base: 'linear-gradient(115deg,#ff6ad5,#ffe066 18%,#7cf7e6 36%,#8aa8ff 54%,#d98bff 72%,#ff9a6b)', light: '#ffffff', ink: '#101018', edge: '#2a2a44', surface: 6, specular: 1.2, exponent: 26, freq: '0.012 0.045', seed: 5 },
};

export function FoilFilter({ id, metal, drift }: { id: string; metal: MetalDef; drift: boolean }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={metal.freq} numOctaves={3} seed={metal.seed} result="n" />
          <feSpecularLighting in="n" surfaceScale={metal.surface} specularConstant={metal.specular} specularExponent={metal.exponent} lightingColor={metal.light} result="s">
            <fePointLight x={40} y={30} z={90}>
              {drift && <animate attributeName="x" values="-20;230;-20" dur="7s" repeatCount="indefinite" />}
              {drift && <animate attributeName="y" values="20;300;20" dur="7s" repeatCount="indefinite" />}
            </fePointLight>
          </feSpecularLighting>
          <feComposite in="s" in2="SourceGraphic" operator="in" result="si" />
          <feComposite in="SourceGraphic" in2="si" operator="arithmetic" k1={0} k2={1} k3={0.9} k4={0} />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Retro Neon: the special-craft pack, drawn after a classic neon-green trading pack,
 * on the same serrated silhouette as every other wrap. The standard version uses retro
 * colors only: flat mint, black, white and a silver holo edge, with the cast in
 * black-and-white duotone. The `arcade` bonus version keeps the busy full-color look
 * (pink burst shadow, halftone, real card backs, ring badge, rainbow edges) and its cast
 * walks across the pack in full color. Live adds motion to either.
 */
export function RetroPack({ pack, walkers, live, arcade = false, fan = [], badge = null }: { pack: PurchasableCardPack; walkers: ReactNode[]; live: boolean; arcade?: boolean; fan?: ReactNode[]; badge?: ReactNode }) {
  const uid = `ccw-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const edge: MetalDef = arcade ? { ...METALS.holo, surface: 3, specular: 0.9, freq: '0.006 0.03', seed: 5 } : { ...METALS.platinum, surface: 3, specular: 0.9, freq: '0.006 0.03', seed: 5 };
  const ring = `COMES WITH ${pack.cards} CARD${pack.cards > 1 ? 'S' : ''} ✦`;
  const burstPoints = '60,2 69,17 87,5 90,23 112,21 102,38 119,48 98,55 107,73 86,67 77,80 66,63 56,80 48,63 30,76 32,57 9,59 22,42 3,32 26,28 21,10 42,18 52,3';
  return (
    <div className={`cc-retro${live ? ' cc-retro--live' : ''}${arcade ? ' cc-retro--arcade' : ''}`}>
      <FoilFilter id={uid} metal={edge} drift={false} />
      {!arcade && (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
          <defs>
            <filter id={`${uid}-duo`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 1 0" />
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0.04 0.96" />
                <feFuncG type="table" tableValues="0.04 1" />
                <feFuncB type="table" tableValues="0.04 0.96" />
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
      )}
      <div className="sheet">
        {arcade && <i className="halft" />}
        <i className="holo t" style={{ filter: `url(#${uid})` }} />
        <i className="holo l" style={{ filter: `url(#${uid})` }} />
        <i className="holo r" style={{ filter: `url(#${uid})` }} />
        <i className="holo b" style={{ filter: `url(#${uid})` }} />
        <svg className="burst cc-loop" viewBox="0 0 120 84" width="104" height="73" aria-hidden="true">
          {arcade && <polygon transform="translate(4 4)" fill="#ff3d8b" points={burstPoints} />}
          <polygon fill="#0a0a0a" points={burstPoints} />
          <text x="60" y="49" textAnchor="middle" fontWeight={900} fontSize="27" fill="#8cf2a0" transform="rotate(-6 60 40)" fontFamily="Oxanium, Arial Black, sans-serif" letterSpacing="1">LOK</text>
        </svg>
        <svg className="ttl" viewBox="0 -8 190 104" width="170" height="93" aria-hidden="true">
          <g transform="rotate(-5 95 48)" fontFamily="Oxanium, Arial Black, sans-serif" fontWeight={900} fontSize="31" textAnchor="middle" strokeLinejoin="round">
            {['TRADING', 'CARD', 'PACK'].map((line, index) => (
              <g key={line} className="ln cc-loop" style={{ animationDelay: `${index * 0.12}s` }}>
                <text x="97" y={26 + index * 28} fill="#0a0a0a" stroke="#0a0a0a" strokeWidth="6">{line}</text>
                <text x="95" y={24 + index * 28} fill="#fffef6" stroke="#0a0a0a" strokeWidth="3.5" paintOrder="stroke">{line}</text>
              </g>
            ))}
          </g>
        </svg>
        <div className="fan">
          {arcade
            ? fan.map((card, index) => <span key={index} className={`fc f${index}`}>{card}</span>)
            : [0, 1, 2].map((index) => <span key={index} className={`fc f${index}`}><b>616</b></span>)}
        </div>
        <div className="badge">
          {arcade ? (
            <>
              <svg className="rt cc-loop" viewBox="0 0 80 80" width="76" height="76" aria-hidden="true">
                <defs><path id={`${uid}-ring`} d="M40,40 m-31,0 a31,31 0 1,1 62,0 a31,31 0 1,1 -62,0" /></defs>
                <text fontFamily="Space Mono, monospace" fontWeight={700} fontSize="7.2" fill="#8cf2a0"><textPath href={`#${uid}-ring`} textLength="190" lengthAdjust="spacing">{ring}</textPath></text>
              </svg>
              <span className="face">{badge}</span>
            </>
          ) : (
            <span>COMES<br />WITH<br /><b>{pack.cards}</b><br />CARD{pack.cards > 1 ? 'S' : ''}</span>
          )}
        </div>
        <i className="road cc-loop" />
        <div className="walk" style={arcade ? undefined : { filter: `url(#${uid}-duo)` }}>
          {walkers.map((walker, index) => (
            <span key={index} className="wk cc-loop" style={{ '--x': `${index * 52}px`, animationDelay: `${-index * 4.2}s`, animationDuration: `${12 - index}s` } as CSSProperties}>{walker}</span>
          ))}
        </div>
        <i className="spark s1 cc-loop" /><i className="spark s2 cc-loop" />{arcade && <i className="spark s3 cc-loop" />}
        <span className="stk">616 SURVIVOR · {pack.name} · {pack.cost} CC</span>
      </div>
    </div>
  );
}
