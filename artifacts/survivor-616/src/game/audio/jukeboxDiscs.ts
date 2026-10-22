/**
 * Disc art for the Lokifed album, drawn by the shared Disc Cascade Carousel.
 *
 * Everything here is procedural (SVG pattern + palette + printed title), so it
 * costs no bitmaps, fonts or network, per `docs/LOK_COST_DISCIPLINE.md`. The
 * styles are keyed by the album's own `trackNumber`, so the audio catalog
 * (`musicPlayer.tsx`, `public/lok-soundtrack.json`) stays the single source of
 * truth for what exists and what is locked; this file only says how a disc
 * looks. No artist or licensing claim is printed on any disc.
 */
import type { DiscCascadeItem, DiscPattern } from '@/components/ui/disc-cascade-carousel';

/** The slice of a player `Track` the discs need (keeps this file free of React). */
export interface DiscTrack {
  id: string;
  title: string;
  source: 'bundled' | 'local';
  trackNumber?: number;
  unlockObjectiveCount?: number;
  locked?: boolean;
}

export interface DiscStyle {
  /** Short text printed on the disc; the full title can be too long for the label. */
  label: string;
  pattern: DiscPattern;
  /** Background, figure, accent. */
  palette: [string, string, string];
}

/** One style per Lokifed track number (0 is the hidden track). */
export const LOKIFED_DISC_STYLES: Record<number, DiscStyle> = {
  0: { label: 'Data Spark', pattern: 'halftone', palette: ['#0a0f1e', '#22d3ee', '#f0abfc'] },
  1: { label: 'Save My Grace', pattern: 'rings', palette: ['#141414', '#e9e4da', '#c8a24a'] },
  2: { label: 'Bonus Map', pattern: 'mosaic', palette: ['#0e0620', '#7c3aed', '#ff2ec4'] },
  3: { label: 'Merci Mi', pattern: 'sunburst', palette: ['#2d3f7a', '#e8b4c8', '#f4efe6'] },
  4: { label: 'I Want You', pattern: 'stripes', palette: ['#1b0a14', '#ff2ec4', '#fde68a'] },
  5: { label: 'Retrieve to Keep', pattern: 'horizon', palette: ['#d9e3df', '#16443f', '#f08a5d'] },
  6: { label: 'IDK, Do You?', pattern: 'eclipse', palette: ['#f0c94c', '#e8572b', '#2b2622'] },
  7: { label: "Blank's March", pattern: 'sunburst', palette: ['#e9e6df', '#1d1d1d', '#d84b3c'] },
  8: { label: 'Hideout Under Siege', pattern: 'horizon', palette: ['#1b1d1f', '#3f6b3a', '#c9d6c4'] },
  9: { label: 'Unraveled', pattern: 'rings', palette: ['#f2e3c6', '#d2452b', '#2a5d8f'] },
  10: { label: 'Null Void', pattern: 'eclipse', palette: ['#050505', '#22d3ee', '#a855f7'] },
  11: { label: 'Exo Bite', pattern: 'mosaic', palette: ['#0b132b', '#5eead4', '#f97316'] },
};

/** A locked disc stays a disc, just dim and sealed, like a locked card. */
const SEALED_PALETTE: [string, string, string] = ['rgba(0,0,0,0)', '#7dd3fc', '#7dd3fc'];

/** The bundled album, in track order. Player-added local files never get a disc. */
export function albumTracks<T extends DiscTrack>(tracks: readonly T[]): T[] {
  return tracks
    .filter((t) => t.source === 'bundled' && typeof t.trackNumber === 'number')
    .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
}

/** The carousel item for one album track. */
export function discItemFor(track: DiscTrack): DiscCascadeItem {
  const n = track.trackNumber ?? 0;
  const style = LOKIFED_DISC_STYLES[n];
  const num = n < 10 ? `0${n}` : `${n}`;
  if (track.locked) {
    const need = track.unlockObjectiveCount ?? 0;
    return {
      title: track.title,
      label: 'Sealed',
      pattern: 'blueprint',
      palette: SEALED_PALETTE,
      ink: '#7dd3fc',
      fine: `Finish ${need} objectives to open  ·  Track ${num}`,
    };
  }
  return {
    title: track.title,
    label: style?.label ?? track.title,
    pattern: style?.pattern,
    palette: style?.palette,
    fine: `Lokifed Take 1  ·  Track ${num}`,
  };
}

/** Which disc should start in the middle: the playing one, else the first unlocked. */
export function startingDisc(discTracks: readonly DiscTrack[], playingId: string | null): number {
  const playing = discTracks.findIndex((t) => t.id === playingId);
  if (playing >= 0) return playing;
  const open = discTracks.findIndex((t) => !t.locked);
  return open >= 0 ? open : 0;
}

/** What a sealed disc still needs: total objectives to open it, how many are done, how many remain. */
export function sealedProgress(track: DiscTrack, completed: number): { need: number; have: number; left: number } {
  const need = Math.max(0, track.unlockObjectiveCount ?? 0);
  const have = Math.max(0, Math.floor(completed));
  return { need, have: Math.min(have, need), left: Math.max(0, need - have) };
}
