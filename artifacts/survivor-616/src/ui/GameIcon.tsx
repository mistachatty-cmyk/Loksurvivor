import type { CSSProperties } from 'react';
import { LOK_GLYPH_PATHS, type LokGlyphKey } from './lokGlyphs.generated';

/**
 * Lok Facet glyphs: original art for this game (see scripts/build-lok-glyphs.py).
 * Design standard: no emoji, no system symbols, no stock icon packs. Data stores a glyph KEY,
 * this component draws it. Canvas code uses drawGlyph() from ./lokGlyphCanvas with the same paths.
 */
export type GameIconKey = LokGlyphKey;

interface GameIconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
  size?: number | string;
  title?: string;
  /** Plays a short pop when the glyph appears or changes state (a check landing, a rank earned). */
  pop?: boolean;
}

export function isGlyphKey(name: string): name is LokGlyphKey {
  return Object.prototype.hasOwnProperty.call(LOK_GLYPH_PATHS, name);
}

/** Unknown names render as plain text so non-icon labels keep working. */
export function GameIcon({ name, className, style, size = '1em', title, pop }: GameIconProps) {
  if (!isGlyphKey(name)) return <>{name}</>;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      fillRule="evenodd"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`lok-glyph${pop ? ' lok-glyph-pop' : ''}${className ? ` ${className}` : ''}`}
      style={{ display: 'inline-block', verticalAlign: '-0.125em', flex: 'none', ...style }}
    >
      <path d={LOK_GLYPH_PATHS[name]} />
    </svg>
  );
}

/** Renders "->" tokens in plain strings as the Lok arrow glyph (evolution chains, level-ups). */
export function GlyphText({ text, className }: { text: string; className?: string }) {
  const parts = text.split('->');
  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? <GameIcon name="arrowR" style={{ margin: '0 0.25em' }} /> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

/** Rarity marks: 1 dot, 2 diamond, 3 to 6 = one to four stars (6 is the Apex tier). */
export function RankMarks({ rank, className }: { rank: number; className?: string }) {
  const glyph: GameIconKey = rank <= 1 ? 'dot' : rank === 2 ? 'diamond' : 'star';
  const count = rank <= 2 ? 1 : rank - 2;
  return (
    <span className={className} style={{ display: 'inline-flex', gap: '0.12em', verticalAlign: '-0.1em' }} aria-label={`Rank ${rank}`}>
      {Array.from({ length: count }, (_, i) => <GameIcon key={i} name={glyph} />)}
    </span>
  );
}
