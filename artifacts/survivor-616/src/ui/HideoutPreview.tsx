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
import { crewTemperamentFor } from '@/game/data/crewTemperaments';
import { crewPose, reactToProp, stepCrew, syncCrew, talkTo, type CrewActor, type CrewEvent } from '@/game/engine/hideoutCrewLife';
import { drawBubble, measureBubble, rectsOverlap, type BubbleRect } from '@/ui/hideoutBubble';
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
  DASH_DOUBLE_TAP_MS,
  DASH_DOUBLE_TAP_PX,
  createOperatorControl,
  nearestProp,
  nudgeOperator,
  setGoal,
  standingSpot,
  startDash,
  stepOperatorControl,
} from '@/game/engine/hideoutWalk';
import { getControls } from '@/game/input/controls';
import type { BondRankId } from '@/game/engine/petGrowth';
import { BOND_RANK_BY_ID } from '@/game/engine/petGrowth';
import {
  CARRY_HEIGHT,
  ballInterest,
  carryBall,
  celebrationStage,
  createBall,
  finishCelebration,
  startFetch,
  stepFetch,
  stepFlight,
  stepRacer,
  throwBall,
  throwFeelFor,
  type BallState,
  type Racer,
} from '@/game/engine/hideoutBall';
import { drawSceneryBack, drawSceneryFront, dustColorFor } from '@/ui/hideoutScenery';
import { AMBIENT_PICKUPS_BY_ID, AMBIENT_TIMING, AMBIENT_VISITORS_BY_ID } from '@/game/data/hideoutAmbient';
import {
  nextPickupAt,
  nextVisitorAt,
  petsToReact,
  pickVisitor,
  pickupDef,
  pickupExpired,
  pickupWithinReach,
  reactionFor,
  spawnPickup,
  spawnVisitor,
  squashActor,
  squashProgress,
  stepActor,
  type AmbientActor,
  type AmbientPickup,
} from '@/game/engine/hideoutAmbient';
import { drawPickup, drawVisitor } from '@/ui/hideoutAmbientArt';
import { drawProp, PROP_HALF_WIDTH_UNITS, PROP_HEIGHT_UNITS } from '@/ui/hideoutPropArt';
import { drawRig } from '@/game/render/sprite';
import { hideoutNoticeMs } from '@/game/state/hideoutNoticeSetting';
import type { EvolutionOverlayId, HideoutBiome, HideoutWeather, LokPetPalette, LokPetSilhouette, SpritePalette, SpriteRig } from '@/game/types';
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
  /** Played with today, which can win a ball-shy pet over. */
  playedToday?: boolean;
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
  /**
   * Who or what the note is about: `operator`, a prop id, or `pet:<id>`. Anchored notes are drawn as a
   * speech bubble beside that thing instead of in a box over the bottom of the strip.
   */
  anchor?: string;
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
  /** Which room's backdrop to paint behind the actors. */
  biome?: HideoutBiome;
  /** Room accent for the backdrop lights. */
  accent?: string;
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
  /** A line for a crew member to say; used when two of them stop to chat. */
  crewSpeak?: (allyId: string) => string | undefined;
  /** The player talked to a crew member (prop id `ally:<id>`): a new `seq` makes them say `line`. */
  say?: { seq: number; propId: string; line: string };
  onPropUse?: (propId: string) => void;
  onFocusPet?: (petId: string) => void;
  /** The operator has walked this many pixels under your control (reported each time it adds up to a stroll). */
  onWalkBeat?: (strollPx: number) => void;
  /** A "something is happening" prompt waiting for a tap. */
  eventChip?: { label: string; aria: string } | null;
  onEventChip?: () => void;
  /** The ball lying in the room, if the player put it out. The UI theme decides how a throw feels. */
  ball?: { present: boolean; themeId: string };
  /** A new value calls a visitor now (the bell). */
  summonSeq?: number;
  /** The operator picked something up off the ground. Return false to leave it there (nothing was paid). */
  onPickup?: (kindId: string, seed: number) => boolean | void;
}

const EMOTE_GLYPHS: Record<HideoutEmote, string> = {
  heart: '♥',
  note: '♪',
  zzz: 'z',
  spark: '✦',
  bang: '!',
  drop: '•',
  star: '★',
  adore: '♡',
  scared: '!?',
  laugh: '^^',
};

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string }
interface Ripple { x: number; born: number }

const MAX_PETS = 4;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function HideoutPreview({
  rig, palette, height = 176, className = '', pets = [], weather = 'clear', biome = 'sanctum', accent = '#f59e0b', eventsMode = 'on',
  onPetCare, onPetEvent, firstEventDelayMs = 9000,
  props: roomProps = [], interactive = false, keyboardActive = true, cue, notice, crewSpeak, say,
  onPropUse, onFocusPet, onWalkBeat, eventChip = null, onEventChip, ball: ballProp, summonSeq, onPickup,
}: HideoutPreviewProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ key: number; title: string; line: string } | null>(null);
  const [nearProp, setNearProp] = useState<{ id: string; label: string; ready: boolean } | null>(null);
  // Speech drawn on the canvas is mirrored here so it is still announced to screen readers.
  const [spoken, setSpoken] = useState('');
  const bubbleQueue = useRef<Array<{ anchor: string; title: string; text: string }>>([]);
  const sayQueue = useRef<Array<{ propId: string; line: string }>>([]);

  // The effect below keeps one canvas loop alive for as long as the operator's look is
  // unchanged, so everything else reaches it through this ref instead of restarting it.
  const live = useRef({
    pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs,
    roomProps, interactive, keyboardActive, cue, onPropUse, onFocusPet, onWalkBeat, ball: ballProp, summonSeq, onPickup, biome, accent, crewSpeak,
  });
  live.current = {
    pets, weather, eventsMode, onPetCare, onPetEvent, firstEventDelayMs,
    roomProps, interactive, keyboardActive, cue, onPropUse, onFocusPet, onWalkBeat, ball: ballProp, summonSeq, onPickup, biome, accent, crewSpeak,
  };

  // Keyed on `seq` so a parent re-render that rebuilds the object does not restart the toast.
  const noticeSeq = notice?.seq;
  useEffect(() => {
    if (!notice) return;
    if (notice.anchor) {
      bubbleQueue.current.push({ anchor: notice.anchor, title: notice.title, text: notice.line });
      setSpoken(`${notice.title}. ${notice.line}`);
    } else {
      setToast({ key: notice.seq, title: notice.title, line: notice.line });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeSeq]);

  const saySeq = say?.seq;
  useEffect(() => {
    if (!say) return;
    sayQueue.current.push({ propId: say.propId, line: say.line });
    setSpoken(say.line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saySeq]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), hideoutNoticeMs());
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
    // The ball (when the player has put it out), and the winner's moves over the head.
    let ball: BallState | null = null;
    let winnerFx: { id: string; x: number; lift: number } | null = null;
    let lastStage = '';
    // Ambient life: visitors crossing the strip, and things lying on the ground.
    const actors: AmbientActor[] = [];
    const pickups: AmbientPickup[] = [];
    let uid = 0;
    const blockedPickups = new Set<number>();
    let lastVisitorKind: string | null = null;
    let nextVisitor = AMBIENT_TIMING.firstVisitorMs;
    let nextPickup = AMBIENT_TIMING.firstPickupMs;
    let lastSummon = live.current.summonSeq ?? 0;
    const callVisitor = (now: number, r: { min: number; max: number }) => {
      const def = pickVisitor(rng, lastVisitorKind);
      lastVisitorKind = def.id;
      actors.push(spawnVisitor(uid += 1, def, r, rng, now));
      bubbleQueue.current.push({ anchor: 'operator', title: t('hideout.ambient.title'), text: t(def.lineKey as never) });
      setSpoken(t(def.lineKey as never));
    };
    // Props are about 32 units tall; one unit is this many pixels on a strip of this height.
    const propUnit = cssH * 0.0105;
    const reachPx = unit * 0.6;
    const propPositions = () => {
      const r = range();
      // Crew are placed where they are standing right now, not at their spot.
      return live.current.roomProps.map((info) => ({ info, x: crewActors.get(info.id)?.x ?? r.min + info.x * (r.max - r.min) }));
    };
    // Crew on the strip: each one stands, paces, fiddles, visits props, chats and greets in
    // their own way (see engine/hideoutCrewLife.ts and data/crewTemperaments.ts).
    const crewActors = new Map<string, CrewActor>();
    let crewRangePrev: { min: number; max: number } | null = null;
    const crewEvents: CrewEvent[] = [];
    const crewIdOf = (id: string) => (id.startsWith('ally:') ? id.slice(5) : id);
    /** Prop id -> strip time it was last used, for its reaction animation. */
    const propFx = new Map<string, number>();
    const PROP_FX_MS = 900;
    let operatorHopAt = -1e9;
    /** Sitting on the window seat: the operator settles until they walk off. */
    let operatorSitUntil = 0;
    /** Afterimages left behind while the operator dashes, newest last. */
    const dashTrail: Array<{ x: number; dir: 1 | -1; born: number }> = [];
    let lastTrailX = Number.NEGATIVE_INFINITY;
    let lastDashing = false;
    let lastTap: { x: number; y: number; at: number } | null = null;
    const OPERATOR_HOP_MS = 420;
    /** Notes shown as bubbles beside what they are about. */
    const notes: Array<{ anchor: string; title: string; text: string; born: number; until: number }> = [];
    const states = new Map<string, HideoutPetState>();
    const looks = new Map<string, { rig: SpriteRig; pal: SpritePalette; scale: number; height: number }>();
    const localHistory = new Map<string, Record<string, number>>();
    const sparks: Spark[] = [];
    const ripples: Ripple[] = [];
    let nextEventAt = live.current.firstEventDelayMs;
    let lastBeatIndex = -1;
    let nextStepPuffAt = 0;
    let raf = 0;

    const burst = (x: number, y: number, color: string, count: number, now: number) => {
      for (let i = 0; i < count && sparks.length < 48; i += 1) {
        const angle = -Math.PI / 2 + (rng() - 0.5) * 2.2;
        const speed = 0.03 + rng() * 0.05;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now, life: 600 + rng() * 400, color });
      }
    };

    /** The operator uses a prop: it reacts, the operator hops, nearby crew look over (or dance), then the parent pays out. */
    const triggerUse = (id: string) => {
      const now = performance.now() - start;
      const prop = propPositions().find((p) => p.info.id === id);
      if (prop && prop.info.art !== 'npc') {
        propFx.set(id, now);
        operatorHopAt = now;
        if (prop.info.art === 'seat') operatorSitUntil = now + 3600;
        operator.dir = prop.x >= operator.x ? 1 : -1;
        burst(prop.x, groundY - PROP_HEIGHT_UNITS * propUnit * 0.6, prop.info.accent, 7, now);
        reactToProp([...crewActors.values()], { x: prop.x, art: prop.info.art }, now, rng, unit * 1.7);
      }
      live.current.onPropUse?.(id);
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
      const sceneAudio = beatBus.read();
      const sceneryOpts = {
        biome: live.current.biome, accent: live.current.accent, w: cssW, h: cssH, groundY, now,
        energy: sceneAudio.source !== 'none' ? sceneAudio.energy : 0, beatPhase: sceneAudio.phase,
        lightX: operator.x, reduceMotion,
      };
      drawSceneryBack(ctx, sceneryOpts);

      if (!reduceMotion) {
        // With Walk and props off the operator only ever wanders, exactly as before.
        if (!settings.interactive) control.mode = 'auto';
        const walk = stepOperatorControl(operator, control, settings.interactive ? keys : { left: false, right: false }, dt, now, r, rng);
        if (walk.arrived && pendingProp) {
          const id = pendingProp;
          pendingProp = null;
          triggerUse(id);
        }
        // A crew member you set off toward may have wandered; keep heading to where they are now.
        if (pendingProp) {
          const target = crewActors.get(pendingProp);
          if (target) {
            const spot = standingSpot(operator.x, target.x, unit * 0.35);
            if (Math.abs(spot - control.goalX) > 6) setGoal(operator, control, spot, now, r, false);
          }
        }
        if (control.strollPx >= 900) {
          const px = control.strollPx;
          control.strollPx = 0;
          settings.onWalkBeat?.(px);
        }
        wanted.forEach((info, slot) => {
          const state = states.get(info.id);
          const racing = ball !== null && ((ball.phase === 'racing' && ball.racers.includes(info.id)) || (ball.phase === 'celebrating' && ball.winnerId === info.id));
          if (state && !racing) stepHideoutPet(state, { dt, now, operator, slot, range: r, unit, rng });
        });
      } else {
        // Reduced motion: a still scene. Pets rest in a row beside the operator.
        wanted.forEach((info, slot) => {
          const state = states.get(info.id);
          if (state) { state.x = operator.x - (slot + 1) * unit * 0.5; state.facing = 1; state.walking = false; }
        });
      }

      // The ball: fetch, carry, throw, race, and the winner's routine.
      const ballCfg = settings.ball;
      if (!ballCfg?.present || reduceMotion) {
        ball = null;
        winnerFx = null;
      } else {
        if (!ball) ball = createBall(r.min + (r.max - r.min) * (0.3 + rng() * 0.4));
        const feel = throwFeelFor(ballCfg.themeId);
        const racerList = (): Racer[] => wanted.flatMap((info) => {
          const s = states.get(info.id);
          if (!s) return [];
          const bondOrder = BOND_RANK_BY_ID[info.bondRank]?.order ?? 0;
          return [{ id: info.id, x: s.x, speed: temperamentFor(info.id).speed, bondOrder, interest: ballInterest({ petId: info.id, bondOrder, playedToday: info.playedToday === true }) }];
        });
        if (ball.phase === 'fetch') stepFetch(ball, operator.x);
        else if (ball.phase === 'carried') carryBall(ball, operator.x);
        else if (ball.phase === 'flying') stepFlight(ball, dt, feel, r, racerList());
        else if (ball.phase === 'racing') {
          for (const racer of racerList()) {
            if (!ball.racers.includes(racer.id)) continue;
            const state = states.get(racer.id);
            if (!state) continue;
            const nextX = stepRacer(ball, racer, dt, now);
            if (nextX !== state.x) state.facing = nextX > state.x ? 1 : -1;
            state.x = nextX;
            state.walking = ball.phase === 'racing';
            state.mode = 'follow';
          }
        } else if (ball.phase === 'celebrating' && ball.winnerId) {
          const winner = states.get(ball.winnerId);
          const stage = celebrationStage(ball, now);
          const headY = rig.pixelHeight * scale * 0.92;
          const side = operator.dir;
          if (winner) {
            const changed = stage.step !== lastStage;
            lastStage = stage.step;
            winner.walking = false;
            if (stage.step === 'spit') {
              if (changed) setEmote(winner, 'bang', now, 900);
              ball.x = winner.x + winner.facing * 8 * stage.progress;
              ball.z = Math.sin(stage.progress * Math.PI) * 22;
              winnerFx = { id: winner.id, x: winner.x, lift: 0 };
            } else if (stage.step === 'spin') {
              if (changed) startMove(winner, 'spin', now, 750);
              ball.z = 0;
              winnerFx = { id: winner.id, x: winner.x, lift: 0 };
            } else if (stage.step === 'head-jump') {
              const fromX = winner.x;
              winnerFx = { id: winner.id, x: fromX + (operator.x - fromX) * stage.progress, lift: Math.sin(stage.progress * Math.PI / 2) * headY };
            } else {
              const landX = operator.x + side * unit * 0.7;
              winnerFx = { id: winner.id, x: operator.x + (landX - operator.x) * stage.progress, lift: headY * (1 - stage.progress) + Math.sin(stage.progress * Math.PI) * 6 };
            }
            if (stage.done) {
              winner.x = operator.x + side * unit * 0.7;
              winner.facing = (side * -1) as 1 | -1;
              winner.mode = 'follow';
              setEmote(winner, 'heart', now, 1800);
              burst(winner.x, groundY - 14, '#fde047', 8, now);
              finishCelebration(ball, operator.x + side * unit * 1.1);
              winnerFx = null;
              lastStage = '';
            }
          } else {
            finishCelebration(ball, operator.x);
          }
        }
      }

      // Ambient life: visitors cross, pets react, the mite can be squashed, things turn up on the ground.
      if (!reduceMotion) {
        const summon = settings.summonSeq ?? 0;
        if (summon !== lastSummon) {
          lastSummon = summon;
          callVisitor(now, r);
        }
        if (settings.eventsMode !== 'off') {
          const slow = settings.eventsMode === 'quiet' ? 3 : 1;
          if (now >= nextVisitor) {
            callVisitor(now, r);
            nextVisitor = nextVisitorAt(now, rng) + (slow - 1) * 40_000;
          }
          if (now >= nextPickup && pickups.length < AMBIENT_TIMING.maxPickups) {
            pickups.push(spawnPickup(uid += 1, r, rng, now));
            nextPickup = nextPickupAt(now, rng) + (slow - 1) * 20_000;
          }
        }
        for (let i = actors.length - 1; i >= 0; i -= 1) {
          const actor = actors[i]!;
          if (stepActor(actor, dt, now, r)) { actors.splice(i, 1); continue; }
          const def = AMBIENT_VISITORS_BY_ID[actor.kindId];
          if (!def) continue;
          const placed = wanted.flatMap((info) => { const s = states.get(info.id); return s ? [{ id: info.id, x: s.x }] : []; });
          for (const petId of petsToReact(actor, placed, unit)) {
            const state = states.get(petId);
            if (!state) continue;
            const reaction = reactionFor(def, state.temperamentId);
            startMove(state, reaction.move, now, 900);
            setEmote(state, reaction.emote, now, 1700);
          }
        }
        for (let i = pickups.length - 1; i >= 0; i -= 1) {
          const pick = pickups[i]!;
          if (pickupExpired(pick, now)) { pickups.splice(i, 1); continue; }
          const inReach = pickupWithinReach([pick], operator.x, unit) !== undefined;
          if (!inReach) blockedPickups.delete(pick.uid);
          if (inReach && !blockedPickups.has(pick.uid) && pickupDef(pick)) {
            const accepted = settings.onPickup?.(pick.kindId, Math.floor(rng() * 0x7fffffff));
            // Nothing was paid (the daily limits): leave it until the operator walks away and back.
            if (accepted === false) { blockedPickups.add(pick.uid); continue; }
            burst(pick.x, groundY - 10, pickupDef(pick)!.color, 6, now);
            pickups.splice(i, 1);
          }
        }
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
      // Crew life: who is on the strip, what they say, and what they are up to this frame.
      {
        const npcInfos = settings.roomProps.filter((info) => info.art === 'npc' && info.npc);
        syncCrew(crewActors, npcInfos.map((info) => ({ id: info.id, homeFrac: info.x, t: crewTemperamentFor(crewIdOf(info.id)) })), r, now, rng, crewRangePrev);
        crewRangePrev = { min: r.min, max: r.max };
        const crewList = [...crewActors.values()];
        for (const queued of sayQueue.current.splice(0)) {
          const actor = crewActors.get(queued.propId);
          if (actor) talkTo(actor, crewList, queued.line, now, operator.x, rng);
          else setToast({ key: Date.now(), title: '', line: queued.line });
        }
        const visitable = placed.filter((p) => p.info.art !== 'npc').map((p) => ({ id: p.info.id, x: p.x, art: p.info.art }));
        stepCrew(crewList, {
          now, dt, range: r, operatorX: operator.x, props: visitable, rng,
          speak: (id) => live.current.crewSpeak?.(crewIdOf(id)), still: reduceMotion,
          quiet: notes.length > 0 || crewList.some((c) => c.behavior === 'talk'),
        }, crewEvents);
        for (const event of crewEvents) if (event.kind === 'visit') propFx.set(event.propId, now);
        crewEvents.length = 0;
      }
      for (const prop of placed) {
        const fxAt = propFx.get(prop.info.id);
        const useAge = fxAt !== undefined && now - fxAt < PROP_FX_MS ? (now - fxAt) / PROP_FX_MS : undefined;
        const actor = prop.info.art === 'npc' && prop.info.npc ? crewActors.get(prop.info.id) : undefined;
        if (actor && prop.info.npc) {
          const pose = crewPose(actor, now, reduceMotion);
          const npcScale = scale * 0.9;
          const height = prop.info.npc.rig.pixelHeight * npcScale;
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(actor.x, groundY, 13 * propUnit * (1 - Math.min(0.35, pose.lift / 30)), 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.save();
          ctx.translate(actor.x, groundY - pose.lift);
          ctx.scale(pose.scaleX, pose.scaleY);
          drawRig(ctx, prop.info.npc.rig, prop.info.npc.palette, pose.anim, reduceMotion ? 0 : now, 0, 0, actor.facing, npcScale, { outline: true });
          ctx.restore();
          if (actor.emote) {
            const age = (now - actor.emote.born) / Math.max(1, actor.emote.until - actor.emote.born);
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - age * age);
            ctx.font = 'bold 15px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            ctx.fillStyle = actor.emote.glyph === 'heart' ? '#ff6fa8' : prop.info.npc.palette.accent;
            const ex = actor.x + (actor.emote.glyph === 'zzz' ? 8 + Math.sin(now / 300) * 3 : 0);
            const ey = groundY - height - 6 - age * 10 - Math.max(0, pose.lift);
            ctx.strokeText(EMOTE_GLYPHS[actor.emote.glyph], ex, ey);
            ctx.fillText(EMOTE_GLYPHS[actor.emote.glyph], ex, ey);
            ctx.restore();
          }
        }
        drawProp(ctx, {
          art: prop.info.art, x: prop.x, groundY, s: propUnit, accent: prop.info.accent,
          ready: prop.info.ready, near: prop.info.id === closeId, now, reduceMotion, useAge,
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

      // Things on the ground and visitors, behind the pets.
      for (const pick of pickups) {
        const def = pickupDef(pick);
        if (def) drawPickup(ctx, def, pick.x, groundY, now, (now - pick.born) / AMBIENT_TIMING.pickupLifeMs);
      }
      for (const actor of actors) {
        const def = AMBIENT_VISITORS_BY_ID[actor.kindId];
        if (def) drawVisitor(ctx, { def, x: actor.x, groundY, h: cssH * def.size * 0.6, dir: actor.dir, now, squash: squashProgress(actor, now) });
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
        const fx = winnerFx && winnerFx.id === info.id ? winnerFx : null;
        const drawX = fx ? fx.x : state.x;
        pose.lift += fx ? fx.lift : 0;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(drawX, groundY, look.height * 0.34 * (1 - Math.min(0.4, pose.lift / 40)), 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(drawX, groundY - pose.lift);
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
          const ex = drawX + (pose.emote === 'zzz' ? 8 + Math.sin(now / 300) * 3 : 0);
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
      const hopAge = (now - operatorHopAt) / OPERATOR_HOP_MS;
      const hopLift = !reduceMotion && hopAge >= 0 && hopAge < 1 ? Math.sin(hopAge * Math.PI) * 9 : 0;
      const sitting = !reduceMotion && now < operatorSitUntil && operator.mode === 'rest';
      if (operator.mode !== 'rest') operatorSitUntil = 0;
      const dashing = !reduceMotion && control.dashing;

      // Dash: afterimages every few pixels, a burst of dust as it kicks off, and speed lines behind.
      if (dashing) {
        if (!lastDashing) {
          lastTrailX = Number.NEGATIVE_INFINITY;
          for (let n = 0; n < 6; n += 1) {
            sparks.push({ x: operator.x - operator.dir * 8, y: groundY - 1, vx: -operator.dir * (0.03 + rng() * 0.05), vy: -0.015 - rng() * 0.02, born: now, life: 420 + rng() * 240, color: dustColorFor(settings.biome) });
          }
        }
        if (Math.abs(operator.x - lastTrailX) >= 16) {
          dashTrail.push({ x: operator.x, dir: operator.dir, born: now });
          lastTrailX = operator.x;
          if (dashTrail.length > 8) dashTrail.shift();
        }
      }
      lastDashing = dashing;
      const GHOST_MS = 260;
      for (let i = dashTrail.length - 1; i >= 0; i -= 1) {
        const ghost = dashTrail[i]!;
        const age = (now - ghost.born) / GHOST_MS;
        if (age >= 1) { dashTrail.splice(i, 1); continue; }
        drawRig(ctx, rig, palette, 'walk', now * 2.4, ghost.x, groundY, ghost.dir, scale, { outline: false, alpha: 0.4 * (1 - age), tint: { color: palette.accent, alpha: 0.55 } });
      }
      if (dashing) {
        ctx.save();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let n = 0; n < 4; n += 1) {
          const y = groundY - (8 + n * 15) * (scale / 3);
          const len = 26 + ((n * 17 + Math.floor(now / 40) * 7) % 22);
          ctx.globalAlpha = 0.45 - n * 0.07;
          ctx.beginPath();
          ctx.moveTo(operator.x - operator.dir * 14, y);
          ctx.lineTo(operator.x - operator.dir * (14 + len), y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(operator.x, groundY - hopLift + (sitting ? 2 : 0));
      if (sitting) ctx.scale(1, 0.9);
      // Leaning into the dash.
      if (dashing) ctx.scale(1.07, 0.95);
      drawRig(ctx, rig, palette, operatorAnim, reduceMotion ? 0 : dashing ? now * 2.4 : now, 0, 0, operatorFacing, scale, { outline: true });
      ctx.restore();

      // The ball, over the operator so a carried one stays visible.
      if (ball) {
        const bx = ball.x;
        const by = groundY - 7 - ball.z;
        ctx.save();
        ctx.globalAlpha = 0.3 * (1 - Math.min(0.6, ball.z / 60));
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(bx, groundY, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(bx - 2, by - 2, 3, Math.PI, Math.PI * 1.6);
        ctx.stroke();
        ctx.restore();
      }

      // Footstep puffs while the operator walks: low, short and grey, unlike the upward sparks.
      if (!reduceMotion && operatorAnim === 'walk' && now >= nextStepPuffAt) {
        nextStepPuffAt = now + 210;
        const dustColor = dustColorFor(settings.biome);
        for (let n = 0; n < 2 && sparks.length < 48; n += 1) {
          sparks.push({ x: operator.x - operator.dir * 6, y: groundY - 1, vx: -operator.dir * (0.01 + rng() * 0.02), vy: -0.012 - rng() * 0.012, born: now, life: 380 + rng() * 220, color: dustColor });
        }
      }

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
      drawSceneryFront(ctx, sceneryOpts);

      // Speech bubbles, last so they sit over everything: crew talk (their own bubble), and
      // anchored notes about a prop, the operator or a pet.
      for (const queued of bubbleQueue.current.splice(0)) {
        const life = clamp(hideoutNoticeMs(), 3500, 9000);
        notes.push({ anchor: queued.anchor, title: queued.title, text: queued.text, born: now, until: now + life });
        // Newer notes about the same thing replace older ones.
        for (let i = notes.length - 2; i >= 0; i -= 1) if (notes[i]!.anchor === queued.anchor) notes.splice(i, 1);
      }
      const operatorHeadY = groundY - rig.pixelHeight * scale;
      const anchorOf = (anchor: string): { x: number; headY: number; accent: string } | null => {
        if (anchor === 'operator') return { x: operator.x, headY: operatorHeadY, accent: palette.accent };
        if (anchor.startsWith('pet:')) {
          const id = anchor.slice(4);
          const info = wanted.find((candidate) => candidate.id === id);
          const state = states.get(id);
          return info && state ? { x: state.x, headY: groundY - petLook(info).height, accent: info.palette.glow } : null;
        }
        const placedProp = placed.find((p) => p.info.id === anchor);
        if (!placedProp) return null;
        const npcRig = placedProp.info.npc?.rig;
        return { x: placedProp.x, headY: groundY - (npcRig ? npcRig.pixelHeight * scale * 0.9 : PROP_HEIGHT_UNITS * propUnit), accent: placedProp.info.accent };
      };
      // What the player asked for goes first; crew chatter is hidden rather than piled on top.
      const taken: BubbleRect[] = [];
      for (let i = notes.length - 1; i >= 0; i -= 1) {
        const note = notes[i]!;
        if (now >= note.until) { notes.splice(i, 1); continue; }
        const at = anchorOf(note.anchor);
        if (!at) { notes.splice(i, 1); setToast({ key: Date.now(), title: note.title, line: note.text }); continue; }
        taken.push(drawBubble(ctx, {
          text: note.text, title: note.title, anchorX: at.x, headY: at.headY, cssW, cssH, accent: at.accent, avoid: taken,
          age: (now - note.born) / (note.until - note.born), sinceMs: now - note.born,
        }));
      }
      const spoken = [...placed].filter((p) => crewActors.get(p.info.id)?.bubble && p.info.npc)
        .sort((p, q) => Number(crewActors.get(q.info.id)!.behavior === 'talk') - Number(crewActors.get(p.info.id)!.behavior === 'talk'));
      for (const prop of spoken) {
        const actor = crewActors.get(prop.info.id)!;
        const bubble = actor.bubble!;
        const input = {
          text: bubble.text, title: prop.info.label, anchorX: actor.x, headY: groundY - prop.info.npc!.rig.pixelHeight * scale * 0.9,
          cssW, cssH, accent: prop.info.npc!.palette.accent, avoid: taken,
        };
        // Chatter between crew only shows where it does not land on something already up.
        if (actor.behavior !== 'talk') {
          const natural = measureBubble(ctx, { ...input, avoid: [] });
          if (taken.some((r) => rectsOverlap(natural, r))) continue;
        }
        taken.push(drawBubble(ctx, { ...input, age: (now - bubble.born) / (bubble.until - bubble.born), sinceMs: now - bubble.born }));
      }
    };
    raf = requestAnimationFrame(frame);

    // Tap a pet to pet it, tap a prop to walk over and use it, tap the ground to walk there.
    // A tap is a quick press that barely moves, so a vertical swipe on the strip still scrolls
    // the page (the canvas only claims horizontal pans) instead of petting or walking.
    let down: { x: number; y: number; at: number; id: number } | null = null;
    const useProp = (id: string) => {
      pendingProp = null;
      triggerUse(id);
    };
    const walkToProp = (id: string, propX: number, now: number) => {
      const r = range();
      const spot = standingSpot(operator.x, propX, unit * 0.35);
      pendingProp = id;
      setGoal(operator, control, spot, now, r, reduceMotion);
      if (reduceMotion) useProp(id);
    };
    const handleTap = (px: number, py: number, pointerType: string) => {
      const now = performance.now() - start;
      const settings = live.current;
      // A second tap right beside the first turns the walk into a dash (same setting as the in-run
      // double-click / double-tap dash).
      const dashAllowed = pointerType === 'mouse' ? getControls().mouse.doubleClickDash : getControls().touch.doubleTapDash;
      const isDouble = Boolean(lastTap) && now - lastTap!.at <= DASH_DOUBLE_TAP_MS
        && Math.hypot(px - lastTap!.x, py - lastTap!.y) <= DASH_DOUBLE_TAP_PX;
      lastTap = isDouble ? null : { x: px, y: py, at: now };
      const dashTo = (x: number) => {
        if (!isDouble || !dashAllowed || !settings.interactive || reduceMotion) return;
        startDash(operator, control, x, now, range(), false);
      };
      if (!reduceMotion) {
        for (const actor of actors) {
          const def = AMBIENT_VISITORS_BY_ID[actor.kindId];
          if (!def?.squashable) continue;
          const half = Math.max(16, cssH * def.size * 0.6 * 0.7);
          if (Math.abs(px - actor.x) <= half && py >= groundY - half - 8 && py <= groundY + 10 && squashActor(actor, now)) {
            burst(actor.x, groundY - 6, def.accent, 8, now);
            bubbleQueue.current.push({ anchor: 'operator', title: t('hideout.ambient.title'), text: t('hideout.ambient.squash') });
            return;
          }
        }
        const tapped = pickups.find((pick) => Math.abs(px - pick.x) <= 16 && py >= groundY - 26 && py <= groundY + 10);
        if (tapped && settings.interactive) {
          pendingProp = null;
          setGoal(operator, control, tapped.x, now, range(), false);
          return;
        }
      }
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
      if (ball && settings.ball?.present && !reduceMotion) {
        if (ball.phase === 'carried') {
          const dir: 1 | -1 = px >= operator.x ? 1 : -1;
          const r0 = range();
          const power = Math.min(1, Math.abs(px - operator.x) / Math.max(1, (r0.max - r0.min) * 0.5));
          if (throwBall(ball, dir, power, throwFeelFor(settings.ball.themeId))) {
            operator.dir = dir;
            ball.z = CARRY_HEIGHT;
            return;
          }
        } else if (ball.phase === 'ground' && settings.interactive && Math.abs(px - ball.x) <= 16 && py >= groundY - 26 && py <= groundY + 10) {
          if (startFetch(ball)) {
            pendingProp = null;
            setGoal(operator, control, ball.x, now, range(), false);
            burst(ball.x, groundY - 8, '#fde047', 4, now);
            return;
          }
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
            dashTo(control.goalX);
            return;
          }
        }
        pendingProp = null;
        const r = range();
        setGoal(operator, control, px, now, r, reduceMotion);
        dashTo(px);
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
      handleTap(event.clientX - rect.left, event.clientY - rect.top, event.pointerType);
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
      {/* Speech drawn on the canvas, repeated for screen readers. */}
      <p className="sr-only" role="status" aria-live="polite" data-testid="hideout-spoken">{spoken}</p>
      {toast ? (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          // Up in the sky, not over the bottom of the strip where everyone's feet are.
          className="pointer-events-none absolute left-3 top-2 z-30 max-w-[min(22rem,calc(100%-1.5rem))] border border-white/15 bg-black/80 px-3 py-1.5 text-white backdrop-blur-sm"
          data-testid="hideout-pet-event"
        >
          {toast.title ? <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-pink-200">{toast.title}</p> : null}
          <p className="mt-0.5 text-xs leading-snug text-white/85">{toast.line}</p>
        </div>
      ) : null}
    </div>
  );
}

export default HideoutPreview;
