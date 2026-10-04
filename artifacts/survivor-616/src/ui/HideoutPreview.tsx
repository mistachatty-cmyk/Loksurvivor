/**
 * The hideout strip: your actual character rig walking along a ground line,
 * rendered with the same `drawRig` the game itself uses (see RigPortrait) -- not a
 * scripted GIF or a pre-rendered clip. It fades out and drifts upward (parallax)
 * as the page scrolls, so it never fights the room nav / Head Out grid for space
 * on a short mobile viewport.
 *
 * Your LokPets walk it with you (v0.11.1): they trail the operator, sit or sniff
 * or nap when the operator stops, bounce to whatever music is playing, splash in
 * the rain, and come when you tap the ground. Tap a pet to pet it (the first pet of
 * the day counts for bond). Small events (`data/hideoutEvents.ts`) play now and then
 * and show a one-line prompt in the corner, never a modal. The movement rules are
 * pure and tested in `engine/hideoutPets.ts`.
 *
 * Deliberately does not run the real simulation (`stepWorld`) -- this is
 * decoration behind static menu content, not gameplay.
 */
import { useEffect, useRef, useState } from 'react';

import { beatBus } from '@/game/audio/beatBus';
import {
  formatEventLine,
  pickHideoutEvent,
  temperamentFor,
  type HideoutEmote,
} from '@/game/data/hideoutEvents';
import { lokPetSpritePalette } from '@/game/data/lokPets';
import { evolvedRig } from '@/game/engine/petEvolution';
import {
  callPets,
  createHideoutPetState,
  createOperatorWalk,
  petPose,
  setEmote,
  startMove,
  stepHideoutPet,
  stepOperatorWalk,
  tapPet,
  type HideoutPetState,
} from '@/game/engine/hideoutPets';
import type { BondRankId } from '@/game/engine/petGrowth';
import { drawRig } from '@/game/render/sprite';
import type { EvolutionOverlayId, HideoutWeather, LokPetPalette, LokPetSilhouette, SpritePalette, SpriteRig } from '@/game/types';
import { prefersReducedMotion as prefersReducedMotionNow } from '@/anim/motion';

/** What the strip needs to know about each pet that walks it. */
export interface HideoutPetInfo {
  id: string;
  /** Call name. */
  name: string;
  /** What the pet calls the player, when that name has been earned. */
  youName?: string;
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  /** Overlay parts from a chosen evolution branch. */
  overlays?: EvolutionOverlayId[];
  sizeScale?: number;
  bondRank: BondRankId;
  /** Events this pet already played: id -> last time (ms). */
  history?: Record<string, number>;
}

export interface HideoutPreviewProps {
  rig: SpriteRig;
  palette: SpritePalette;
  /** Canvas height in CSS pixels. */
  height?: number;
  className?: string;
  /** Pets that walk the strip (the parent decides how many). */
  pets?: HideoutPetInfo[];
  weather?: HideoutWeather;
  /** How often events play. */
  eventsMode?: 'on' | 'quiet' | 'off';
  /** The pet was petted. The parent decides whether it counts (once a day). */
  onPetCare?: (petId: string) => void;
  /** An event played for a pet. The parent saves the reward and cooldown. */
  onPetEvent?: (petId: string, eventId: string) => void;
  /** Delay before the first event, ms. */
  firstEventDelayMs?: number;
}

const EMOTE_GLYPHS: Record<HideoutEmote, string> = {
  heart: '♥',
  note: '♪',
  zzz: 'z',
  spark: '✦',
  bang: '!',
  drop: '•',
  star: '★',
};

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string }
interface Ripple { x: number; born: number }

const MAX_PETS = 4;

export function HideoutPreview({
  rig, palette, height = 176, className = '', pets = [], weather = 'clear', eventsMode = 'on',
  onPetCare, onPetEvent, firstEventDelayMs = 9000,
}: HideoutPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ key: number; title: string; line: string } | null>(null);

  // The effect below keeps one canvas loop alive for as long as the operator's look is
  // unchanged, so everything else reaches it through this ref instead of restarting it.
  const live = useRef({ pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs });
  live.current = { pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = prefersReducedMotionNow();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = root.clientWidth;
    const cssH = height;

    const resize = () => {
      cssW = root.clientWidth;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    let isVisible = document.visibilityState === 'visible';
    const onVisibility = () => { isVisible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVisibility);

    // Fade + parallax drift over the first ~220px of scroll -- past that the
    // preview is fully hidden and costs nothing but a `display: none` check.
    const FADE_RANGE_PX = 220;
    let scrollT = 0;
    const onScroll = () => {
      const rect = root.getBoundingClientRect();
      const scrolledPast = Math.max(0, -rect.top);
      scrollT = Math.min(1, scrolledPast / FADE_RANGE_PX);
      root.style.opacity = String(1 - scrollT);
      root.style.transform = reduceMotion ? 'none' : `translateY(${-scrollT * 32}px)`;
      root.style.pointerEvents = scrollT >= 1 ? 'none' : 'auto';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const scale = (cssH * 0.7) / rig.pixelHeight;
    const groundY = cssH * 0.86;
    const unit = cssH * 0.5;
    const range = () => {
      const w = Math.max(cssW * 0.6, 1);
      const margin = (cssW - w) / 2;
      return { min: margin, max: margin + w };
    };

    const start = performance.now();
    let last = start;
    const rng = Math.random;
    const operator = createOperatorWalk(range(), 0);
    if (reduceMotion) operator.mode = 'rest';
    const states = new Map<string, HideoutPetState>();
    const looks = new Map<string, { rig: SpriteRig; pal: SpritePalette; scale: number; height: number }>();
    const localHistory = new Map<string, Record<string, number>>();
    const sparks: Spark[] = [];
    const ripples: Ripple[] = [];
    let nextEventAt = live.current.firstEventDelayMs;
    let lastBeatIndex = -1;
    let raf = 0;

    const burst = (x: number, y: number, color: string, count: number, now: number) => {
      for (let i = 0; i < count && sparks.length < 48; i += 1) {
        const angle = -Math.PI / 2 + (rng() - 0.5) * 2.2;
        const speed = 0.03 + rng() * 0.05;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now, life: 600 + rng() * 400, color });
      }
    };

    const petLook = (info: HideoutPetInfo) => {
      // Keyed by the look too, so choosing an evolution branch updates the strip without a remount.
      const lookKey = `${info.id}|${info.overlays?.join(',') ?? ''}|${info.palette.accent}|${info.palette.glow}|${info.sizeScale ?? 1}`;
      let look = looks.get(lookKey);
      if (!look) {
        const petRig = evolvedRig(info.silhouette, info.overlays);
        const petScale = (cssH * 0.7 * 0.4 / petRig.pixelHeight) * Math.max(0.8, Math.min(1.35, info.sizeScale ?? 1));
        look = { rig: petRig, pal: lokPetSpritePalette(info.palette), scale: petScale, height: petRig.pixelHeight * petScale };
        looks.set(lookKey, look);
      }
      return look;
    };

    // Keep the strip's pets in step with what the parent says is walking it.
    const syncPets = (now: number) => {
      const wanted = live.current.pets.slice(0, MAX_PETS);
      for (const info of wanted) {
        if (!states.has(info.id)) {
          const index = states.size;
          states.set(info.id, createHideoutPetState(info.id, operator.x - (index + 1) * unit * 0.5));
        }
      }
      for (const id of [...states.keys()]) {
        if (!wanted.some((info) => info.id === id)) { states.delete(id); for (const key of [...looks.keys()]) if (key.startsWith(`${id}|`)) looks.delete(key); }
      }
      return wanted;
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (!isVisible || scrollT >= 1) { last = time; return; }
      const now = time - start;
      const dt = Math.min(50, time - last);
      last = time;
      const r = range();
      const wanted = syncPets(now);
      const settings = live.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      if (!reduceMotion) {
        stepOperatorWalk(operator, dt, now, r, rng);
        wanted.forEach((info, slot) => {
          const state = states.get(info.id);
          if (state) stepHideoutPet(state, { dt, now, operator, slot, range: r, unit, rng });
        });
      } else {
        // Reduced motion: a still scene. Pets rest in a row beside the operator.
        wanted.forEach((info, slot) => {
          const state = states.get(info.id);
          if (state) { state.x = operator.x - (slot + 1) * unit * 0.5; state.facing = 1; state.walking = false; }
        });
      }

      // Music: a quiet strip when nothing plays, a bouncing one when something does.
      const audio = beatBus.read();
      const groove = { active: audio.source !== 'none' && audio.energy > 0.04, phase: audio.phase, energy: audio.energy };
      if (groove.active && !reduceMotion && audio.beatIndex !== lastBeatIndex) {
        lastBeatIndex = audio.beatIndex;
        if (audio.beatIndex % 4 === 0) {
          wanted.forEach((info) => {
            const state = states.get(info.id);
            if (state) burst(state.x, groundY - petLook(info).height * 0.9, info.palette.glow, 3, now);
          });
        }
      }

      // Events: now and then one pet plays a short scene, with a one-line prompt.
      if (settings.eventsMode !== 'off' && !reduceMotion && wanted.length > 0 && now >= nextEventAt) {
        const idle = wanted.filter((info) => !states.get(info.id)?.move);
        const info = idle[Math.floor(rng() * idle.length)];
        const state = info ? states.get(info.id) : undefined;
        let played = false;
        if (info && state) {
          const wall = Date.now();
          const history = { ...(info.history ?? {}), ...(localHistory.get(info.id) ?? {}) };
          const def = pickHideoutEvent(
            { hour: new Date(wall).getHours(), weather: settings.weather, musicPlaying: groove.active, bondRank: info.bondRank, temperament: temperamentFor(info.id).id },
            history, wall, rng,
          );
          if (def) {
            played = true;
            startMove(state, def.move, now, def.durationMs);
            setEmote(state, def.emote, now, Math.min(def.durationMs, 2600));
            localHistory.set(info.id, { ...(localHistory.get(info.id) ?? {}), [def.id]: wall });
            burst(state.x, groundY - petLook(info).height, info.palette.glow, 6, now);
            setToast({ key: wall, title: def.title, line: formatEventLine(def, { pet: info.name, you: info.youName }) });
            settings.onPetEvent?.(info.id, def.id);
          }
        }
        const gap = (settings.eventsMode === 'quiet' ? 3 : 1) * (played ? 16000 + rng() * 18000 : 7000);
        nextEventAt = now + gap;
      }

      // Rain: ripples on the ground.
      if (settings.weather === 'rain' && !reduceMotion) {
        if (ripples.length < 4 && rng() < 0.03) ripples.push({ x: r.min + rng() * (r.max - r.min), born: now });
        for (let i = ripples.length - 1; i >= 0; i -= 1) {
          const age = (now - ripples[i]!.born) / 1100;
          if (age >= 1) { ripples.splice(i, 1); continue; }
          ctx.save();
          ctx.globalAlpha = 0.35 * (1 - age);
          ctx.strokeStyle = '#bcd7ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(ripples[i]!.x, groundY + 2, 4 + age * 14, 1.5 + age * 4, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Pets first, so the operator stays in front of them.
      wanted.forEach((info) => {
        const state = states.get(info.id);
        if (!state) return;
        const look = petLook(info);
        const pose = petPose(state, now, groove, reduceMotion);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(state.x, groundY, look.height * 0.34 * (1 - Math.min(0.4, pose.lift / 40)), 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(state.x, groundY - pose.lift);
        ctx.scale(pose.scaleX, pose.scaleY);
        ctx.shadowColor = info.palette.glow;
        ctx.shadowBlur = 6;
        drawRig(ctx, look.rig, look.pal, 'idle', now, 0, 0, pose.facing, look.scale, { outline: true, alpha: pose.alpha });
        ctx.restore();
        if (pose.emote) {
          const fade = 1 - pose.emoteAge * pose.emoteAge;
          ctx.save();
          ctx.globalAlpha = Math.max(0, fade);
          ctx.font = 'bold 15px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.65)';
          ctx.fillStyle = pose.emote === 'heart' ? '#ff6fa8' : info.palette.glow;
          const ex = state.x + (pose.emote === 'zzz' ? 8 + Math.sin(now / 300) * 3 : 0);
          const ey = groundY - look.height - 8 - pose.emoteAge * 10 - pose.lift;
          ctx.strokeText(EMOTE_GLYPHS[pose.emote], ex, ey);
          ctx.fillText(EMOTE_GLYPHS[pose.emote], ex, ey);
          ctx.restore();
        }
      });

      // The operator.
      const operatorFacing: 1 | -1 = operator.dir;
      const operatorAnim = reduceMotion || operator.mode === 'rest' ? 'idle' : 'walk';
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(operator.x, groundY, rig.pixelHeight * scale * 0.32, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawRig(ctx, rig, palette, operatorAnim, reduceMotion ? 0 : now, operator.x, groundY, operatorFacing, scale, { outline: true });

      // Sparks.
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i]!;
        const age = (now - s.born) / s.life;
        if (age >= 1) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.00006 * dt;
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(frame);

    // Tap a pet to pet it; tap the ground and the pets trot over.
    const onPointerDown = (event: PointerEvent) => {
      const wanted = live.current.pets.slice(0, MAX_PETS);
      if (wanted.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const now = performance.now() - start;
      let hit: HideoutPetInfo | undefined;
      let hitState: HideoutPetState | undefined;
      for (const info of wanted) {
        const state = states.get(info.id);
        if (!state) continue;
        const look = petLook(info);
        const halfW = look.height * 0.55 + 10;
        if (Math.abs(px - state.x) <= halfW && py >= groundY - look.height - 16 && py <= groundY + 10) {
          hit = info;
          hitState = state;
          break;
        }
      }
      if (hit && hitState) {
        tapPet(hitState, now);
        burst(hitState.x, groundY - petLook(hit).height, hit.palette.glow, 5, now);
        live.current.onPetCare?.(hit.id);
      } else if (!reduceMotion) {
        const r = range();
        callPets([...states.values()], Math.max(r.min, Math.min(r.max, px)), now, r, unit);
        ripples.push({ x: px, born: now });
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
    };
  }, [rig, palette, height]);

  return (
    <div
      ref={rootRef}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
      data-testid="hideout-preview"
    >
      {/* The global stylesheet gives every aria-hidden element pointer-events: none, so the canvas
          is exposed as a labelled image instead: it has to take taps. */}
      {/* The canvas below only clears to transparent, so without this the
          hideout's own weather rain-particle layer (rendered behind the whole
          screen) shows through raw and unstyled, reading as a visual glitch
          slicing across the character instead of atmosphere. Same dim
          treatment AttractMode's own background sim uses. */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-black/35" aria-hidden="true" />
      <canvas ref={canvasRef} className={`relative z-10 block h-full w-full ${pets.length > 0 ? 'cursor-pointer' : ''}`} role="img" aria-label={pets.length > 0 ? 'Your operator and LokPets in the hideout. Tap a pet to pet it, or tap the ground to call it over.' : 'Your operator walking the hideout'} data-testid="hideout-preview-canvas" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
      {toast ? (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-2 left-3 z-30 max-w-[min(26rem,calc(100%-1.5rem))] border border-white/15 bg-black/70 px-3 py-1.5 text-white backdrop-blur-sm"
          data-testid="hideout-pet-event"
        >
          <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-pink-200">{toast.title}</p>
          <p className="mt-0.5 text-xs leading-snug text-white/85">{toast.line}</p>
        </div>
      ) : null}
    </div>
  );
}

export default HideoutPreview;
