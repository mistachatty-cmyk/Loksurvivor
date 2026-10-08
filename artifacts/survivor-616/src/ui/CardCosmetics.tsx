/**
 * Visuals for the Lock Pack Counter cosmetics (data/cardCosmetics.ts): pack
 * skins, district card backs and the two collected-card layouts. All art is the
 * game's own sprite rigs, drawn live, so a pack or back always shows a fighter or
 * LokPet that exists in the game.
 *
 * Each piece is drawn at a fixed design size and scaled by <FluidScaled>.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import {
  BACK_HUB_FIGURE,
  boxShellFor,
  foilStyleFor,
  packLotNumber,
  PACK_FEATURED,
  type CardMotion,
  type FeaturedFigure,
} from '@/game/data/cardCosmetics';
import { LOKPET_VARIANTS, lokPetSpritePalette } from '@/game/data/lokPets';
import { getCardVariableProfile } from '@/game/data/cardVariables';
import { evolvedRig } from '@/game/engine/petEvolution';
import type { PurchasableCardPack } from '@/game/data/passiveCards';
import type { LokAssetManifest } from '@/game/lok/types';
import type { SpritePalette, SpriteRig } from '@/game/types';
import { RigPortrait } from './RigPortrait';
import './cardCosmetics.css';

/* ---------- scaling and motion helpers ---------- */

/** Draws children at `w` x `h` and scales them to fill the parent's width (up to `maxWidth`). */
export function FluidScaled({ w, h, maxWidth, children, className = '' }: { w: number; h: number; maxWidth?: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Math.min(w, maxWidth ?? w));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(40, Math.min(el.clientWidth || w, maxWidth ?? Infinity)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [w, maxWidth]);

  const scale = width / w;
  return (
    <div ref={ref} className={className} style={{ width: '100%', maxWidth, marginInline: 'auto' }}>
      <div style={{ width, height: h * scale, position: 'relative', marginInline: 'auto' }}>
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>{children}</div>
      </div>
    </div>
  );
}

/** Pointer tilt with a light that follows the cursor, only in `full` motion. */
export function TiltBox({ motion, children, className = '', style }: { motion: CardMotion; children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || motion !== 'full') return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--ry', `${((x - 0.5) * 22).toFixed(1)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 22).toFixed(1)}deg`);
    el.classList.add('cc-live');
  };
  const leave = () => ref.current?.classList.remove('cc-live');
  return (
    <div ref={ref} className={`cc-tilt ${className}`} style={style} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}

/* ---------- figures (real sprite rigs) ---------- */

interface ResolvedFigure {
  rig: SpriteRig;
  palette: SpritePalette;
  name: string;
  accent: string;
  /** Short line about what it does: a character's attack, or a pet's family. */
  tagline: string;
}

export function resolveFigure(figure: FeaturedFigure): ResolvedFigure | null {
  if (figure.kind === 'character') {
    const character = CHARACTERS_BY_ID[figure.id];
    if (!character) return null;
    return {
      rig: character.rig,
      palette: character.palette,
      name: character.name,
      accent: character.palette.accent,
      tagline: `${character.weapon.name} ${Math.round(character.weapon.damage)}`,
    };
  }
  const variant = LOKPET_VARIANTS.find((entry) => entry.id === figure.id);
  if (!variant) return null;
  return {
    rig: evolvedRig(variant.silhouette, undefined),
    palette: lokPetSpritePalette(variant.palette),
    name: variant.name,
    accent: variant.palette.accent,
    tagline: `${variant.family} companion`,
  };
}

function Figure({ figure, size, animated }: { figure: FeaturedFigure; size: number; animated: boolean }) {
  const resolved = resolveFigure(figure);
  if (!resolved) return null;
  return (
    <span className="cc-spr fig" style={{ display: 'block', width: size, height: size }}>
      <RigPortrait rig={resolved.rig} palette={resolved.palette} size={size} animated={animated} />
    </span>
  );
}

/* ---------- pack skins ---------- */

function FoilPack({ pack }: { pack: PurchasableCardPack }) {
  const style = foilStyleFor(pack.id);
  return (
    <div className={`cc-foil cc-pat-${style.pattern}`} style={{ '--a': style.a, '--b': style.b, '--glow': style.glow } as CSSProperties}>
      <div className="pouch" />
      <i className="crimp t" />
      <i className="crimp b" />
      <div className="face">
        <span className="kick">{style.kicker}</span>
        <span className="mark">{style.mark}</span>
        <span className="nm">{pack.name}</span>
        <div className="foot">
          <span>{pack.cards} CARD{pack.cards > 1 ? 'S' : ''}</span>
          <span>{pack.cost} CC</span>
        </div>
      </div>
    </div>
  );
}

function PrintedPack({ pack, motion }: { pack: PurchasableCardPack; motion: CardMotion }) {
  const featured = PACK_FEATURED[pack.id];
  const resolved = featured ? resolveFigure(featured) : null;
  const accent = resolved?.accent ?? foilStyleFor(pack.id).a;
  const title = resolved?.name ?? pack.name;
  return (
    <div className="cc-print" style={{ '--ac': accent } as CSSProperties}>
      <div className="sheet">
        <i className="crimp t" />
        <div className="head">
          <span>{foilStyleFor(pack.id).kicker}</span>
          <b className={title.length > 9 ? 'long' : ''}>{title}</b>
        </div>
        <div className="stage">{featured && <Figure figure={featured} size={170} animated={motion === 'full'} />}</div>
        <div className="move">{resolved?.tagline ?? pack.name}</div>
        <div className="ribbon">{pack.name}</div>
        <div className="price">{pack.cost}<small>CC</small></div>
        <div className="foot">
          <span>{pack.cards} CARD{pack.cards > 1 ? 'S' : ''}<br />LOT {packLotNumber(pack.id)}</span>
          <span className="bar" />
        </div>
        <i className="crimp b" />
        <i className="crease" />
        <i className="nz cc-noise" />
      </div>
    </div>
  );
}

function BoxedPack({ pack }: { pack: PurchasableCardPack }) {
  const shell = boxShellFor(pack.id);
  const style = foilStyleFor(pack.id);
  return (
    <div className="cc-boxed">
      <div className={`box ${shell}`}>
        <div className="lid"><div className="lbl"><b>{pack.name}</b></div></div>
        <div className="fc back" />
        <div className="fc left" />
        <div className="fc bottom" />
        <div className="inner" />
        <div className="pc a" />
        <div className="pc b" />
        <div className="pc c" />
        <div className="fc front">
          <div className="lbl">
            <b>{pack.name}</b>
            <i>{style.kicker} · {pack.cards} cards</i>
          </div>
        </div>
        <div className="fc right"><span className="spine">{style.mark} · {pack.cost} CC</span></div>
      </div>
    </div>
  );
}

/** Design size of every pack skin except the box, so the shop grid stays even. */
export const PACK_ART_SIZE = { w: 190, h: 304 };

export function PackArt({ pack, skin, motion = 'subtle', maxWidth = 170 }: { pack: PurchasableCardPack; skin: string; motion?: CardMotion; maxWidth?: number }) {
  const body =
    skin === 'pack-foil' ? <FoilPack pack={pack} /> : skin === 'pack-printed' ? <PrintedPack pack={pack} motion={motion} /> : skin === 'pack-boxed' ? <BoxedPack pack={pack} /> : null;
  if (!body) return null;
  const h = PACK_ART_SIZE.h;
  return (
    <div className="cc-root" data-cc-motion={motion} data-testid={`pack-art-${pack.id}`}>
      <TiltBox motion={motion}>
        <FluidScaled w={PACK_ART_SIZE.w} h={h} maxWidth={maxWidth}>{body}</FluidScaled>
      </TiltBox>
    </div>
  );
}

/* ---------- card backs ---------- */

export function CardBackArt({ backId, motion = 'subtle', animated = false }: { backId: string; motion?: CardMotion; animated?: boolean }) {
  const theme = backId.replace('back-', '');
  const hub = BACK_HUB_FIGURE[backId];
  return (
    <div className={`cc-root cc-back cc-back--${theme}`} data-cc-motion={motion} data-testid={`card-back-${theme}`}>
      <i className="fr" />
      <i className="in" />
      <u className="st" /><u className="st" /><u className="st" /><u className="st" />
      <div className="core">{hub ? <Figure figure={hub} size={86} animated={animated && motion === 'full'} /> : <b>616</b>}</div>
      <i className="shine" />
    </div>
  );
}

/** A back scaled to fit its container, used by the shop preview and the pack reveal. */
export function ScaledCardBack({ backId, motion = 'subtle', maxWidth = 200 }: { backId: string; motion?: CardMotion; maxWidth?: number }) {
  return (
    <TiltBox motion={motion}>
      <FluidScaled w={200} h={280} maxWidth={maxWidth}>
        <CardBackArt backId={backId} motion={motion} />
      </FluidScaled>
    </TiltBox>
  );
}

/* ---------- collected-card layouts ---------- */

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8',
  uncommon: '#34d399',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#f9a8d4',
  mythic: '#fde68a',
  secret: '#f87171',
};

const SHINY_VARIANTS = new Set(['foil', 'holo', 'glitch', 'neon']);

interface LayoutCardProps {
  layout: 'printed' | 'tcg';
  card: LokAssetManifest;
  owned: boolean;
  copies?: number;
  variant?: string;
  motion?: CardMotion;
  /** Renders the card's art at the given pixel size (the caller already has `CardArtwork`). */
  art: (size: number) => ReactNode;
  onClick?: () => void;
}

export function LayoutCard({ layout, card, owned, variant, motion = 'subtle', art, onClick }: LayoutCardProps) {
  const profile = getCardVariableProfile(card);
  const shiny = owned && Boolean(variant && SHINY_VARIANTS.has(variant));
  const rarityColor = RARITY_COLOR[card.rarity] ?? RARITY_COLOR.common;
  const label = owned ? card.name : 'Unknown Card';
  const move = profile.moves[0];
  const power = profile.specialPowers[0];

  const face =
    layout === 'printed' ? (
      <div className="cc-card cc-card--printed" style={{ '--ac': profile.elementColor } as CSSProperties}>
        <i className="nz cc-noise" />
        <div className="ttl">
          <b>{label}</b>
          <span>{owned ? `${profile.stats.hp} HP` : '?? HP'}</span>
        </div>
        <div className={`stage ${owned ? '' : 'cc-card--sealed'}`}>
          {shiny && <i className="foilpatch" />}
          <span className="cc-spr fig" style={{ display: 'block', filter: owned ? undefined : 'grayscale(1) brightness(.3)' }}>{art(132)}</span>
          <span className="tag">{owned ? `${profile.elementLabel} · ${profile.fightingStyleLabel}` : 'Sealed'}</span>
        </div>
        {owned ? (
          <>
            <div className="cbox">
              <span className="tg">Attack</span>
              <div className="row"><span>{move.name}</span><em>{move.damage}</em></div>
              <p>{move.description}</p>
            </div>
            <div className="cbox ult"><span>Ability</span><span>{power?.name ?? 'None'}</span></div>
          </>
        ) : (
          <div className="cbox"><span className="tg">Sealed</span><p>Find or buy a Lock Pack to reveal this card.</p></div>
        )}
        <div className="bot">
          <span><i className={`pip ${card.rarity === 'rare' ? 'r' : card.rarity === 'mythic' || card.rarity === 'secret' ? 'e' : ''}`} />{card.rarity}</span>
          <span>{profile.collectorNumber}</span>
        </div>
      </div>
    ) : (
      <div className={`cc-card cc-card--tcg ${shiny ? 'holo' : ''}`} style={{ '--el': profile.elementColor } as CSSProperties}>
        <div className="line"><b>{label}</b>{owned && <span className="cost">{profile.stats.spCost}</span>}</div>
        <div className={`art ${owned ? '' : 'cc-card--sealed'}`}>
          <span className="cc-spr fig" style={{ display: 'block' }}>{art(138)}</span>
          {shiny && <i className="sheen cc-loop" />}
          {!owned && <span className="seal"><Lock style={{ width: 18, height: 18 }} /></span>}
        </div>
        <div className="line type">
          <b>{owned ? `${profile.fightingStyleLabel} — ${profile.evolutionStage}` : 'Sealed card'}</b>
          <i className="sym" style={{ background: rarityColor }} />
        </div>
        <div className="rules">
          {owned ? (
            <>
              {power && <span className="ab"><strong>{power.name}.</strong> {power.description}</span>}
              <span className="mv"><span>{move.name} ({move.energyCost})</span><span>{move.damage}</span></span>
              <span className="fl">{profile.flavorText}</span>
              <span className="pt">{profile.stats.attack}/{profile.stats.hp}</span>
            </>
          ) : (
            <span className="ab">Stats, abilities and flavor stay sealed until you collect this card.</span>
          )}
        </div>
        <div className="base">
          <span>{profile.collectorNumber} · {card.rarity.charAt(0).toUpperCase()}</span>
          <span>{owned ? profile.illustrator : '616 Survivor'}</span>
        </div>
      </div>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      className="cc-root block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      data-cc-motion={motion}
      data-testid={`card-lok-${card.slug}`}
      aria-label={`${label}, ${card.rarity}${owned ? '' : ', locked'}`}
    >
      <TiltBox motion={motion}>
        <FluidScaled w={210} h={294} maxWidth={230}>{face}</FluidScaled>
      </TiltBox>
    </button>
  );
}
