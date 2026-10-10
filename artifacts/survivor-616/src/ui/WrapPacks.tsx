/**
 * Premium pack wraps for the Lock Pack Counter: metal and holo foil, the Retro
 * Neon walker pack, Kraft Sleeve and Street Stock. Drawn at the same 190 x 304
 * design size as every other pack skin and scaled by <FluidScaled>.
 *
 * Foil is a real crinkle, not a gradient: an SVG turbulence map lit by a point
 * light. With motion "full" the light drifts across the wrap; otherwise it is
 * fixed, so a shelf of packs costs one paint each. The fighter art and the
 * walkers come in as `art` / `walkers` from CardCosmetics so every figure is a
 * real in-game rig.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';

import type { CardMotion, WrapFinish } from '@/game/data/cardCosmetics';
import type { PurchasableCardPack } from '@/game/data/passiveCards';

interface MetalDef {
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

const METALS: Record<WrapFinish, MetalDef> = {
  gold: { name: 'Gilt Foil', base: 'linear-gradient(115deg,#6b4a0a,#e8c35a 25%,#fff0a8 40%,#b9872a 58%,#f1cf6a 78%,#6b4a0a)', light: '#fff3c0', ink: '#3f2b05', edge: '#8a6218', surface: 6, specular: 1.1, exponent: 24, freq: '0.012 0.045', seed: 3 },
  platinum: { name: 'Platinum Chrome', base: 'linear-gradient(115deg,#6f7883,#f3f6f9 25%,#a5afbb 42%,#ffffff 56%,#7a8490 78%,#c6ced8)', light: '#ffffff', ink: '#20262d', edge: '#5b6571', surface: 5, specular: 1.3, exponent: 30, freq: '0.010 0.050', seed: 7 },
  bronze: { name: 'Foundry Bronze', base: 'linear-gradient(125deg,#3d2110,#a8673a 32%,#dca06f 48%,#8a4b22 72%,#3d2110)', light: '#ffd9b0', ink: '#fbe9d6', edge: '#2a160a', surface: 7, specular: 0.9, exponent: 18, freq: '0.015 0.040', seed: 11 },
  holo: { name: 'Prism Holo', base: 'linear-gradient(115deg,#ff6ad5,#ffe066 18%,#7cf7e6 36%,#8aa8ff 54%,#d98bff 72%,#ff9a6b)', light: '#ffffff', ink: '#101018', edge: '#2a2a44', surface: 6, specular: 1.2, exponent: 26, freq: '0.012 0.045', seed: 5 },
};

function FoilFilter({ id, metal, drift }: { id: string; metal: MetalDef; drift: boolean }) {
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

export function MetalPack({ pack, finish, motion, art, figureName }: { pack: PurchasableCardPack; finish: WrapFinish; motion: CardMotion; art: ReactNode; figureName?: string }) {
  const metal = METALS[finish];
  const uid = `ccw-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className={`cc-wrap cc-wrap--${finish}`} style={{ '--ink': metal.ink, '--edge': metal.edge } as CSSProperties}>
      <FoilFilter id={uid} metal={metal} drift={motion === 'full'} />
      <div className="foil" style={{ background: metal.base, filter: `url(#${uid})` }} />
      <i className="bend" />
      <i className="crimp t" />
      <i className="crimp b" />
      <div className="plate">
        <i className="halftone" />
        <div className="fig">{art}</div>
      </div>
      <div className="lock">
        <b className="t1">{figureName ?? pack.name}</b>
        <span className="t2">{metal.name}</span>
      </div>
      <div className="tier">{pack.cards} CARD{pack.cards > 1 ? 'S' : ''} · {pack.cost} CC</div>
      <div className="legal">LOK 616 · SLEEVE COUNTER</div>
      <i className="scuff" />
    </div>
  );
}

/** Retro Neon: a flat neon-green pouch, black linework, a holo edge strip and digitized fighters walking across it. */
export function RetroPack({ pack, walkers }: { pack: PurchasableCardPack; walkers: ReactNode[] }) {
  const uid = `ccw-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const holo: MetalDef = { ...METALS.holo, surface: 3, specular: 0.8, freq: '0.006 0.03', seed: 5 };
  return (
    <div className="cc-retro">
      <FoilFilter id={uid} metal={holo} drift={false} />
      <i className="holo r" style={{ filter: `url(#${uid})` }} />
      <i className="holo b" style={{ filter: `url(#${uid})` }} />
      <svg className="burst" viewBox="0 0 120 80" width="104" height="70" aria-hidden="true">
        <polygon fill="#0a0a0a" points="60,2 70,18 88,6 90,24 112,22 102,38 118,48 98,54 106,72 86,66 78,78 66,62 56,78 48,62 30,74 32,56 10,58 22,42 4,32 26,28 22,10 42,18 52,4" />
        <text x="60" y="48" textAnchor="middle" fontWeight={900} fontSize="26" fill="#86ee8c" transform="rotate(-6 60 40)" fontFamily="Oxanium, Arial Black, sans-serif">LOK</text>
      </svg>
      <b className="ttl">TRADING<br />CARD<br />PACK</b>
      <span className="bdg">COMES WITH {pack.cards} CARD{pack.cards > 1 ? 'S' : ''}</span>
      <i className="crd" />
      <i className="ground" />
      <div className="walk">
        {walkers.map((walker, index) => (
          <span key={index} className="wk cc-loop" style={{ '--x': `${index * 56}px`, animationDelay: `${-index * 4}s` } as CSSProperties}>{walker}</span>
        ))}
      </div>
      <span className="stk">{pack.name} · {pack.cost} CC</span>
    </div>
  );
}

/** Kraft Sleeve: warm craft paper with a letterpress stamp. */
export function KraftPack({ pack, art, figureName }: { pack: PurchasableCardPack; art: ReactNode; figureName?: string }) {
  return (
    <div className="cc-kraft">
      <i className="grain" />
      <i className="fold" />
      <div className="stamp">
        <div className="fig">{art}</div>
      </div>
      <b className="t1">{figureName ?? pack.name}</b>
      <span className="t2">KRAFT SLEEVE</span>
      <span className="tag">{pack.cards} CARD{pack.cards > 1 ? 'S' : ''} · {pack.cost} CC</span>
      <i className="twine" />
    </div>
  );
}

/** Street Stock: matte printed stock with a spot-color stripe, built to sit under the foils. */
export function StockPack({ pack, art, accent, figureName }: { pack: PurchasableCardPack; art: ReactNode; accent: string; figureName?: string }) {
  return (
    <div className="cc-stock" style={{ '--spot': accent } as CSSProperties}>
      <i className="dots" />
      <i className="stripe" />
      <div className="plate">
        <div className="fig">{art}</div>
      </div>
      <b className="t1">{figureName ?? pack.name}</b>
      <span className="t2">STREET STOCK</span>
      <span className="tier">{pack.cards} CARD{pack.cards > 1 ? 'S' : ''} · {pack.cost} CC</span>
    </div>
  );
}
