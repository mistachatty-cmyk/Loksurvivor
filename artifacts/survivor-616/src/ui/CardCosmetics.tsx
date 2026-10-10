/**
 * Visuals for the Lock Pack Counter cosmetics (data/cardCosmetics.ts): pack
 * skins, district card backs and the two collected-card layouts. All art is the
 * game's own sprite rigs, drawn live, so a pack or back always shows a fighter or
 * LokPet that exists in the game.
 *
 * Each piece is drawn at a fixed design size and scaled by <FluidScaled>.
 */
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Lock } from 'lucide-react';

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import {
  BACK_HUB_FIGURE,
  boxShellFor,
  foilStyleFor,
  packLotNumber,
  LIVE_PACK_SKINS,
  PACK_FEATURED,
  RETRO_WALKERS,
  WRAP_FINISH_BY_SKIN,
  type CardMotion,
  type FeaturedFigure,
  type WrapFinish,
} from '@/game/data/cardCosmetics';
import { LOKPET_VARIANTS, lokPetSpritePalette } from '@/game/data/lokPets';
import { getCardVariableProfile } from '@/game/data/cardVariables';
import { evolvedRig } from '@/game/engine/petEvolution';
import type { PurchasableCardPack } from '@/game/data/passiveCards';
import type { LokAssetManifest } from '@/game/lok/types';
import type { AnimName, SpritePalette, SpriteRig } from '@/game/types';
import { RigPortrait } from './RigPortrait';
import { FoilFilter, METALS, RetroPack } from './WrapPacks';
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

function Figure({ figure, size, animated, anim, pixelScale }: { figure: FeaturedFigure; size: number; animated: boolean; anim?: AnimName; pixelScale?: number }) {
  const resolved = resolveFigure(figure);
  if (!resolved) return null;
  return (
    <span className="cc-spr fig" style={{ display: 'block', width: size, height: size }}>
      <RigPortrait rig={resolved.rig} palette={resolved.palette} size={size} animated={animated} anim={anim} pixelScale={pixelScale} />
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

/** What the standard pack frame is printed on. `print` is the original pink Fighter Print stock. */
export type PackMaterial = 'print' | WrapFinish | 'kraft' | 'stock';

/**
 * The standard pack frame: serrated edge, header, framed stage, ribbon, price
 * roundel, barcode and lot line, crimp, crease and paper noise. Every wrap uses
 * it and only swaps `material`; a pack leaves it only when a special craft needs a
 * different layout (Retro Neon). Foil materials draw a crinkled foil layer under
 * the print, and Live wraps drift the light and twinkle when motion is "full".
 */
function PrintedPack({ pack, motion, material = 'print', live = false, spot }: { pack: PurchasableCardPack; motion: CardMotion; material?: PackMaterial; live?: boolean; spot?: string }) {
  const featured = PACK_FEATURED[pack.id];
  const resolved = featured ? resolveFigure(featured) : null;
  const accent = resolved?.accent ?? foilStyleFor(pack.id).a;
  const title = resolved?.name ?? pack.name;
  const metal = material === 'gold' || material === 'platinum' || material === 'bronze' || material === 'holo' ? METALS[material] : null;
  const uid = `ccp-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const kicker = metal ? metal.name : material === 'kraft' ? 'Kraft Sleeve' : material === 'stock' ? 'Street Stock' : foilStyleFor(pack.id).kicker;
  const style = material === 'print' ? ({ '--ac': accent } as CSSProperties) : material === 'stock' ? ({ '--spot': spot ?? accent } as CSSProperties) : undefined;
  return (
    <div className={`cc-print cc-print--${material}${live ? ' cc-print--live' : ''}`} style={style}>
      {metal && <FoilFilter id={uid} metal={metal} drift={live && motion === 'full'} />}
      <div className="sheet">
        {metal && <i className="mat" style={{ background: metal.base, filter: `url(#${uid})` }} />}
        {material === 'kraft' && <i className="mat grain" />}
        {material === 'stock' && <><i className="mat dots" /><i className="spot" /></>}
        <i className="crimp t" />
        <div className="head">
          <span>{kicker}</span>
          <b className={title.length > 9 ? 'long' : ''}>{title}</b>
        </div>
        <div className="stage">{featured && <Figure figure={featured} size={170} animated={motion === 'full' && live} />}</div>
        <div className="move">{resolved?.tagline ?? pack.name}</div>
        <div className="ribbon">{pack.name}</div>
        <div className="price">{pack.cost}<small>CC</small></div>
        <div className="foot">
          <span>{pack.cards} CARD{pack.cards > 1 ? 'S' : ''}<br />LOT {packLotNumber(pack.id)}</span>
          <span className="bar" />
        </div>
        <i className="crimp b" />
        <i className="crease" />
        {live && <><i className="spark s1 cc-loop" /><i className="spark s2 cc-loop" /><i className="spark s3 cc-loop" /></>}
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

/** Wraps built on the standard frame, plus the one special-craft layout (Retro Neon). */
function WrapBody({ pack, skin, motion }: { pack: PurchasableCardPack; skin: string; motion: CardMotion }) {
  const live = LIVE_PACK_SKINS.has(skin);
  const finish = WRAP_FINISH_BY_SKIN[skin];
  if (finish) return <PrintedPack pack={pack} motion={motion} material={finish} live={live} />;
  if (skin === 'pack-kraft') return <PrintedPack pack={pack} motion={motion} material="kraft" />;
  if (skin === 'pack-stock') return <PrintedPack pack={pack} motion={motion} material="stock" />;
  if (skin === 'pack-retro' || skin === 'pack-retro-live' || skin === 'pack-retro-arcade') {
    const arcade = skin === 'pack-retro-arcade';
    const walking = live && motion === 'full';
    const walkers = RETRO_WALKERS.map((figure) => <Figure key={figure.id} figure={figure} size={64} animated={walking} anim={walking ? 'walk' : 'idle'} pixelScale={2} />);
    const fan = arcade ? ['back-neon', 'back-iron', 'back-default'].map((id) => <ScaledCardBack key={id} backId={id} motion="off" maxWidth={46} />) : [];
    const badge = arcade ? <Figure figure={RETRO_WALKERS[1]!} size={84} animated={false} /> : null;
    return <RetroPack pack={pack} walkers={walkers} live={live} arcade={arcade} fan={fan} badge={badge} />;
  }
  return null;
}

export function PackArt({ pack, skin, motion = 'subtle', maxWidth = 170 }: { pack: PurchasableCardPack; skin: string; motion?: CardMotion; maxWidth?: number }) {
  const body =
    skin === 'pack-foil' ? <FoilPack pack={pack} /> : skin === 'pack-printed' ? <PrintedPack pack={pack} motion={motion} /> : skin === 'pack-boxed' ? <BoxedPack pack={pack} /> : <WrapBody pack={pack} skin={skin} motion={motion} />;
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
