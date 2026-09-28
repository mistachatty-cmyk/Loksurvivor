/**
 * A lightweight, non-combat "showcase" scene for the title screen's
 * background sim -- 2-3 characters posed together, trading idle/attack/hurt
 * beats like a friendly sparring match, instead of the usual bot-vs-horde
 * scene.
 *
 * Deliberately skips the real simulation entirely: no `World`, no
 * `stepWorld`. `render/sprite.ts`'s `drawRig`/`drawShadow` are stateless
 * screen-space draw calls that only need a character's own `rig`/`palette`
 * (every `CharacterDef` already carries both), so this is just a handful of
 * posed rigs on a timer -- zero engine risk, and no new `AnimName` needed
 * (there's no `'dance'` clip in this codebase; a loose "swaying together"
 * read comes from `idle`'s existing gentle bob at staggered per-actor
 * offsets, and "punching each other" reuses the real `attack`/`hurt` clips).
 */
import type { AnimName, CharacterDef } from '@/game/types';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { CHARACTERS } from '@/game/data/characters';

const SCALE = 2.15;
const BEAT_MS = 1100;

export interface ShowcaseActor {
  character: CharacterDef;
  x: number;
  y: number;
  facing: 1 | -1;
  anim: AnimName;
  animStartedAt: number;
  /** This actor's turn to "attack" happens on odd/even beats depending on this offset. */
  beatOffset: number;
}

export interface ShowcaseScene {
  actors: ShowcaseActor[];
  startedAt: number;
  nextBeatAt: number;
  beatIndex: number;
}

/** 2 or 3 distinct characters, uniformly random. */
function pickCast(): CharacterDef[] {
  const pool = [...CHARACTERS];
  const size = pool.length >= 3 && Math.random() < 0.5 ? 3 : Math.min(2, pool.length);
  const cast: CharacterDef[] = [];
  for (let i = 0; i < size && pool.length > 0; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    cast.push(pool.splice(index, 1)[0]!);
  }
  return cast;
}

export function createShowcaseScene(now: number, width: number, height: number): ShowcaseScene {
  const cast = pickCast();
  const centerX = width / 2;
  // Below the intro's centered title/button copy, in the clearer lower band.
  const centerY = height * 0.74;
  const spacing = Math.min(width * 0.22, 160);
  const startX = centerX - (spacing * (cast.length - 1)) / 2;
  const actors: ShowcaseActor[] = cast.map((character, index) => ({
    character,
    x: startX + spacing * index,
    y: centerY,
    facing: index % 2 === 0 ? 1 : -1,
    anim: 'idle',
    animStartedAt: now,
    beatOffset: index,
  }));
  return { actors, startedAt: now, nextBeatAt: now + BEAT_MS, beatIndex: 0 };
}

/** Advances the sparring beat: alternating pairs trade attack/hurt, everyone else idles. */
export function stepShowcaseScene(scene: ShowcaseScene, now: number) {
  if (now < scene.nextBeatAt) return;
  scene.nextBeatAt = now + BEAT_MS;
  scene.beatIndex += 1;
  scene.actors.forEach((actor, index) => {
    const isActive = (scene.beatIndex + actor.beatOffset) % scene.actors.length === 0;
    const nextAnim: AnimName = scene.actors.length < 2
      ? 'idle'
      : isActive
        ? 'attack'
        : (scene.beatIndex + actor.beatOffset) % scene.actors.length === 1
          ? 'hurt'
          : 'idle';
    if (nextAnim !== actor.anim) {
      actor.anim = nextAnim;
      actor.animStartedAt = now;
    }
  });
}

export function drawShowcaseScene(ctx: CanvasRenderingContext2D, scene: ShowcaseScene, now: number) {
  for (const actor of scene.actors) {
    const elapsed = now - actor.animStartedAt;
    drawShadow(ctx, actor.x, actor.y + 2, 14 * SCALE * 0.4);
    drawRig(ctx, actor.character.rig, actor.character.palette, actor.anim, elapsed, actor.x, actor.y, actor.facing, SCALE);
  }
}
