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
 * Walk and props (v0.15.0): tap the ground or press the arrow keys / A and D to walk
 * the operator yourself, and walk up to the props of the room (`data/hideoutProps.ts`)
 * to use them. After a few idle seconds the operator goes back to wandering. The
 * steering rules are pure and tested in `engine/hideoutWalk.ts`; turning "Walk and
 * props" off in Settings gives back the old tap-to-call behavior unchanged.
 *
 * Deliberately does not run the real simulation (`stepWorld`) -- this is
 * decoration behind static menu content, not gameplay.
 */
import { useEffect, useRef, useState } from 'react';

import { useT } from '@/lib/i18n';

import { beatBus } from '@/game/audio/beatBus';
import {
  formatEventLine,
  pickHideoutEvent,
  temperamentFor,
  type HideoutEmote,
  type HideoutMove,
} from '@/game/data/hideoutEvents';
import type { PropArt } from '@/game/data/hideoutProps';
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
  tapPet,
  type HideoutPetState,
} from '@/game/engine/hideoutPets';
import {
  createOperatorControl,
  nearestProp,
  nudgeOperator,
  setGoal,
  standingSpot,
  stepOperatorControl,
} from '@/game/engine/hideoutWalk';
import type { BondRankId } from '@/game/engine/petGrowth';
import { drawProp, PROP_HALF_WIDTH_UNITS, PROP_HEIGHT_UNITS } from '@/ui/hideoutPropArt';
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

/** A prop standing in the current room, already translated and with its ready state worked out. */
export interface HideoutPropInfo {
  id: string;
  /** 0 to 1 along the walking range. */
  x: number;
  art: PropArt;
  accent: string;
  label: string;
  /** Using it would pay out right now. */
  ready: boolean;
  npc?: { rig: SpriteRig; palette: SpritePalette };
}

/** A pet play move the parent wants the strip to perform. A new `seq` triggers it. */
export interface PlayCue {
  seq: number;
  petId: string;
  move: HideoutMove;
  emote: HideoutEmote;
  durationMs: number;
}

/** A line to show in the corner. A new `seq` shows it. */
export interface StripNotice {
  seq: number;
  title: string;
  line: string;
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
  /** Props in the room. Empty when Walk and props is off. */
  props?: HideoutPropInfo[];
  /** Walk with taps and keys. Off keeps the old tap-the-ground-to-call behavior. */
  interactive?: boolean;
  /** False while a dialog is open, so keys never steer behind it. */
  keyboardActive?: boolean;
  cue?: PlayCue;
  notice?: StripNotice;
  onPropUse?: (propId: string) => void;
  onFocusPet?: (petId: string) => void;
  /** The operator has walked this many pixels under your control (reported each time it adds up to a stroll). */
  onWalkBeat?: (strollPx: number) => void;
  /** A "something is happening" prompt waiting for a tap. */
  eventChip?: { label: string; aria: string } | null;
  onEventChip?: () => void;
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
  props: roomProps = [], interactive = false, keyboardActive = true, cue, notice,
  onPropUse, onFocusPet, onWalkBeat, eventChip = null, onEventChip,
}: HideoutPreviewProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ key: number; title: string; line: string } | null>(null);
  const [nearProp, setNearProp] = useState<{ id: string; label: string; ready: boolean } | null>(null);

  // The effect below keeps one canvas loop alive for as long as the operator's look is
  // unchanged, so everything else reaches it through this ref instead of restarting it.
  const live = useRef({
    pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs,
    roomProps, interactive, keyboardActive, cue, onPropUse, onFocusPet, onWalkBeat,
  });
  live.current = {
    pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs,
    roomProps, interactive, keyboardActive, cue, onPropUse, onFocusPet, onWalkBeat,
  };

  // Keyed on `seq` so a parent re-render that rebuilds the object does not restart the toast.
  const noticeSeq = notice?.seq;
  useEffect(() => {
    if (notice) setToast({ key: notice.seq, title: notice.title, line: notice.line });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeSeq]);

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
    const control = createOperatorControl();
    const keys = { left: false, right: false };
    /** A prop the player tapped; used the moment the operator reaches it. */
    let pendingProp: string | null = null;
    let nearId: string | null = null;
    let lastCueSeq = live.current.cue?.seq ?? 0;
    // Props are about 32 units tall; one unit is this many pixels on a strip of this height.
    const propUnit = cssH * 0.0105;
    const reachPx = unit * 0.6;
    const propPositions = () => {
      const r = range();
      return live.current.roomProps.map((info) => ({ info, x: r.min + info.x * (r.max - r.min) }));
    };
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
        // With Walk and props off the operator only ever wanders, exactly as before.
        if (!settings.interactive) control.mode = 'auto';
        const walk = stepOperatorControl(operator, control, settings.interactive ? keys : { left: false, right: false }, dt, now, r, rng);
        if (walk.arrived && pendingProp) {
          const id = pendingProp;
          pendingProp = null;
          settings.onPropUse?.(id);
        }
        if (control.strollPx >= 900) {
          const px = control.strollPx;
          control.strollPx = 0;
          settings.onWalkBeat?.(px);
        }
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

      // A play move from the parent (scratch, fetch, nap together...).
      const cueNow = settings.cue;
      if (cueNow && cueNow.seq !== lastCueSeq) {
        lastCueSeq = cueNow.seq;
        const state = states.get(cueNow.petId);
        const info = wanted.find((candidate) => candidate.id === cueNow.petId);
        if (state && info) {
          state.mode = 'follow';
          startMove(state, cueNow.move, now, cueNow.durationMs);
          setEmote(state, cueNow.emote, now, Math.min(cueNow.durationMs, 2600));
          burst(state.x, groundY - petLook(info).height, info.palette.glow, 6, now);
        }
      }

      // Which prop is within reach (drives the prompt chip), and draw them behind the pets.
      const placed = propPositions();
      const close = settings.interactive ? nearestProp(operator.x, placed, reachPx) : null;
      const closeId = close ? close.info.id : null;
      if (closeId !== nearId) {
        nearId = closeId;
        setNearProp(close ? { id: close.info.id, label: close.info.label, ready: close.info.ready } : null);
      }
      for (const prop of placed) {
        if (prop.info.art === 'npc' && prop.info.npc) {
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(prop.x, groundY, 13 * propUnit, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          drawRig(ctx, prop.info.npc.rig, prop.info.npc.palette, 'idle', reduceMotion ? 0 : now, prop.x, groundY, operator.x >= prop.x ? 1 : -1, scale * 0.9, { outline: true });
        }
        drawProp(ctx, {
          art: prop.info.art, x: prop.x, groundY, s: propUnit, accent: prop.info.accent,
          ready: prop.info.ready, near: prop.info.id === closeId, now, reduceMotion,
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

    // Tap a pet to pet it, tap a prop to walk over and use it, tap the ground to walk there.
    // A tap is a quick press that barely moves, so a vertical swipe on the strip still scrolls
    // the page (the canvas only claims horizontal pans) instead of petting or walking.
    let down: { x: number; y: number; at: number; id: number } | null = null;
    const useProp = (id: string) => {
      pendingProp = null;
      live.current.onPropUse?.(id);
    };
    const walkToProp = (id: string, propX: number, now: number) => {
      const r = range();
      const spot = standingSpot(operator.x, propX, unit * 0.35);
      pendingProp = id;
      setGoal(operator, control, spot, now, r, reduceMotion);
      if (reduceMotion) useProp(id);
    };
    const handleTap = (px: number, py: number) => {
      const now = performance.now() - start;
      const settings = live.current;
      const wanted = settings.pets.slice(0, MAX_PETS);
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
        settings.onPetCare?.(hit.id);
        settings.onFocusPet?.(hit.id);
        return;
      }
      if (settings.interactive) {
        for (const prop of propPositions()) {
          const half = Math.max(22, PROP_HALF_WIDTH_UNITS * propUnit);
          if (Math.abs(px - prop.x) <= half && py >= groundY - (PROP_HEIGHT_UNITS + 10) * propUnit && py <= groundY + 10) {
            burst(prop.x, groundY - PROP_HEIGHT_UNITS * propUnit, prop.info.accent, 4, now);
            walkToProp(prop.info.id, prop.x, now);
            return;
          }
        }
        pendingProp = null;
        const r = range();
        setGoal(operator, control, px, now, r, reduceMotion);
        ripples.push({ x: Math.max(r.min, Math.min(r.max, px)), born: now });
        return;
      }
      if (wanted.length > 0 && !reduceMotion) {
        const r = range();
        callPets([...states.values()], Math.max(r.min, Math.min(r.max, px)), now, r, unit);
        ripples.push({ x: px, born: now });
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, at: performance.now(), id: event.pointerId };
    };
    const onPointerUp = (event: PointerEvent) => {
      const started = down;
      down = null;
      if (!started || started.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - started.x, event.clientY - started.y) > 10 || performance.now() - started.at > 450) return;
      const rect = canvas.getBoundingClientRect();
      handleTap(event.clientX - rect.left, event.clientY - rect.top);
    };
    const onPointerCancel = () => { down = null; };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    // Keyboard: left/right (or A/D) walk, E or Enter uses the prop beside you. Up, down and
    // space are left alone so the page still scrolls, and nothing is read while you type or a
    // dialog is open.
    const typingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    };
    const keyReady = (event: KeyboardEvent) => {
      const settings = live.current;
      return settings.interactive && settings.keyboardActive && scrollT < 1 && isVisible && !event.defaultPrevented
        && !document.querySelector('[aria-modal="true"]')
        && !event.ctrlKey && !event.metaKey && !event.altKey && !typingTarget(event.target);
    };
    const directionOf = (key: string): 'left' | 'right' | null => {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'left';
      if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'right';
      return null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!keyReady(event)) return;
      const side = directionOf(event.key);
      if (side) {
        event.preventDefault();
        pendingProp = null;
        if (reduceMotion) {
          if (!event.repeat) nudgeOperator(operator, control, side === 'right' ? 1 : -1, unit * 0.5, performance.now() - start, range());
        } else {
          keys[side] = true;
        }
        return;
      }
      const active = document.activeElement;
      const onBody = !active || active === document.body;
      if (event.key === 'e' || event.key === 'E' || (event.key === 'Enter' && onBody)) {
        const close = nearestProp(operator.x, propPositions(), reachPx);
        if (close) {
          event.preventDefault();
          useProp(close.info.id);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const side = directionOf(event.key);
      if (side) keys[side] = false;
    };
    const clearKeys = () => { keys.left = false; keys.right = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
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
      <canvas
        ref={canvasRef}
        className={`relative z-10 block h-full w-full ${pets.length > 0 || interactive ? 'cursor-pointer' : ''}`}
        style={{ touchAction: 'pan-y' }}
        role="img"
        aria-label={interactive ? t('hideout.life.stripAria') : pets.length > 0 ? 'Your operator and LokPets in the hideout. Tap a pet to pet it, or tap the ground to call it over.' : 'Your operator walking the hideout'}
        data-testid="hideout-preview-canvas"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />
      {(interactive && nearProp) || eventChip ? (
        <div className="absolute bottom-2 right-3 z-30 flex flex-col items-end gap-1.5">
          {eventChip ? (
            <button
              type="button"
              onClick={onEventChip}
              className="min-h-9 border border-pink-200/60 bg-pink-950/80 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-pink-100 backdrop-blur-sm hover:border-pink-100"
              aria-label={eventChip.aria}
              data-testid="hideout-event-chip"
            >
              ! {eventChip.label}
            </button>
          ) : null}
          {interactive && nearProp ? (
            <button
              type="button"
              onClick={() => live.current.onPropUse?.(nearProp.id)}
              className="min-h-9 border border-white/25 bg-black/75 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-sm hover:border-white/60"
              data-testid="hideout-prop-prompt"
            >
              {t('hideout.life.useProp', { label: nearProp.label })}{nearProp.ready ? ' •' : ''}
            </button>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute left-3 z-30 max-w-[calc(100%-1.5rem)] border border-white/15 bg-black/85 px-3 py-1.5 text-white backdrop-blur-sm ${(interactive && nearProp) || eventChip ? 'bottom-16' : 'bottom-2'}`}
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
