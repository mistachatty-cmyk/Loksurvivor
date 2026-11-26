/**
 * BoardScreen -- Turbo Crown Blitz on the Monroe Loop (Lok Party Slice 3).
 *
 * Draws and paces the pure board engine (lokBoard.ts). Human choices are big cream buttons at
 * thumb height (fired on pointerdown); bots think for a beat so turns read like a show.
 * The Lok Drop runs as the 30-second minigame between rounds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { useT, type MessageKey } from '@/lib/i18n';
import { createJuice, drawRefractionRings, impact, Squash, type Juice } from './juiceEngine';
import {
  CROWN_COST,
  SIGNATURE_DICE,
  boardAct,
  boardAdvance,
  boardMinigameResult,
  botAction,
  createBoardGame,
  isOvertime,
  type BoardAction,
  type BoardEvent,
  type BoardState,
  type DieFace,
  type ItemId,
} from './lokBoard';
import { MONROE_LOOP } from './boards/monroeLoop';
import {
  BUILDINGS,
  GANTRY_SORT,
  GOLDEN,
  MIDNIGHT,
  P,
  PROPS,
  SIGN_COLORS,
  SLIDE_SORT,
  WORLD_H,
  WORLD_W,
  bakeBuilding,
  bakeGantry,
  bakeGround,
  bakeSlide,
  createCityState,
  drawCoin,
  drawCrown,
  drawDiceBlock,
  drawEdge,
  drawLiveAir,
  drawLiveGround,
  drawOwl,
  drawProp,
  drawSpace,
  nodeSortY,
  propHit,
  propSortY,
  rgba,
  signRect,
  windowRects,
  type Sprite,
} from './boardArt';
import { DropArena, seatOrder } from './LokDropScreen';
import { dropResults, type DropState } from './lokDrop';
import { minigamePlacements, seatToBot, type OnlineSession, type Seat } from './partyNet';

const LANE = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
const CREAM = '#FAF6EE';
const ESPRESSO = '#3b2a20';
const HOP_MS = 230;
const RIG_SCALE = 1.45;

interface Props {
  humanId: string;
  rounds?: number;
  seed: number;
  ladderTier: number;
  getAudioContext: () => AudioContext | null;
  onFinish: (s: BoardState, localSeat: number) => void;
  /** Present when this is an online party. */
  online?: OnlineSession;
  onQuit: () => void;
}

interface Float {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  coin?: boolean;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  r: number;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function faceLabel(f: DieFace): string {
  if (typeof f === 'number') return String(f);
  return { 'freeze-rival': 'FREEZE', 'plus-cred': '+3', 'boulder-ride': 'BOULDER', gilded: 'GILDED' }[f];
}

export type SeatRole = 'local' | 'bot' | 'remote';

export function BoardScreen({ humanId, rounds = 10, seed, ladderTier, getAudioContext, onFinish, onQuit, online }: Props) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seats = useMemo(() => (online ? online.seats.map((st) => st.characterId) : seatOrder(humanId)), [humanId, online]);
  const localSeat = online ? online.mySeat : 0;
  const seatsRef = useRef<Seat[] | null>(online ? online.seats : null);
  const roleOf = useCallback((i: number): SeatRole => {
    if (i === localSeat) return 'local';
    if (!seatsRef.current) return 'bot';
    return seatsRef.current[i]?.kind === 'bot' ? 'bot' : 'remote';
  }, [localSeat]);
  const stateRef = useRef<BoardState>(
    createBoardGame(online ? online.seed : seed, MONROE_LOOP, seats.map((id, i) => ({ characterId: id, bot: i !== localSeat })), online ? online.rounds : rounds),
  );
  const [waitingOthers, setWaitingOthers] = useState(false);
  const [hostGone, setHostGone] = useState(false);
  const [sent, setSent] = useState(false);
  const sentRef = useRef(false);
  sentRef.current = sent;
  const [ui, setUi] = useState(0); // bump to re-render DOM prompts
  const [minigame, setMinigame] = useState<number | null>(null);
  const [overview, setOverview] = useState(false);
  const overviewRef = useRef(false);
  overviewRef.current = overview;
  const actRef = useRef<(a: BoardAction) => void>(() => {});
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const minigameDoneRef = useRef<(d: DropState) => void>(() => {});

  const labelsRef = useRef({
    round: (r: number, m: number) => t('lokParty.board.round', { round: r, max: m }),
    overtime: t('lokParty.board.overtime'),
    night: t('lokParty.board.night'),
    day: t('lokParty.board.day'),
    minigame: t('lokParty.board.minigame'),
    yourTurn: t('lokParty.board.yourTurn'),
    turn: (name: string) => t('lokParty.board.turn', { name }),
    crownGet: t('lokParty.board.crownGet'),
    frozen: t('lokParty.board.frozen'),
    trap: t('lokParty.board.trap'),
    swapCoins: t('lokParty.board.swapCoins'),
    swapPlaces: t('lokParty.board.swapPlaces'),
    archon: t('lokParty.board.archon'),
    gotItem: (item: string) => t('lokParty.board.gotItem', { item }),
    event: (name: string) => t(`lokParty.board.event.${name}` as MessageKey),
    item: (id: string) => t(`lokParty.item.${id}` as MessageKey),
    bonusTitle: t('lokParty.bonus.title'),
    bonus: (id: string) => t(`lokParty.bonus.${id}` as MessageKey),
    nobody: t('lokParty.bonus.nobody'),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;
    const L = labelsRef.current;
    const motion = prefersReducedMotion() ? 0 : 1;
    const juice: Juice = createJuice(getAudioContext, { motion, bpm: 104 });
    const ensureAudio = () => void getAudioContext()?.resume?.();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bakeScale = Math.min(2, Math.max(1, dpr * 0.9));
    const city = createCityState();
    const grounds: { day: HTMLCanvasElement | null; night: HTMLCanvasElement | null } = { day: null, night: null };
    const getBackdrop = (night: boolean) => {
      const key = night ? 'night' : 'day';
      if (!grounds[key]) grounds[key] = bakeGround(night ? MIDNIGHT : GOLDEN, bakeScale);
      return grounds[key]!;
    };
    // Depth-sorted sprites, baked lazily per mood.
    const sprites = new Map<string, Sprite>();
    const sprite = (key: string, night: boolean, make: () => Sprite) => {
      const k = `${key}:${night ? 'n' : 'd'}`;
      let sp = sprites.get(k);
      if (!sp) {
        sp = make();
        sprites.set(k, sp);
      }
      return sp;
    };
    const rebakeBuilding = (seed: number) => {
      sprites.delete(`b${seed}:d`);
      sprites.delete(`b${seed}:n`);
    };
    const xray = new Map<number, number>();
    const propReact = new Map<number, number>();
    const tileBounce = new Map<string, number>();
    let owlHopAt = -9999;
    const ripples: { x: number; y: number; born: number }[] = [];
    const stars: { x: number; y: number; vx: number; vy: number; born: number }[] = [];
    getBackdrop(false);

    let W = 0;
    let H = 0;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Display positions and hop animations.
    const disp = s.players.map((p) => {
      const n = s.map[p.node];
      const pt = P(n.x, n.y, n.z);
      return { x: pt.x, y: pt.y, fromX: pt.x, fromY: pt.y, toX: pt.x, toY: pt.y, start: -1, dur: HOP_MS, arc: 28, facing: 1 as 1 | -1 };
    });
    const squash = s.players.map(() => new Squash());
    const floats: Float[] = [];
    const bits: Bit[] = [];
    const banners: { text: string; color: string; sub?: string; ms: number }[] = [];
    let banner: { text: string; color: string; sub?: string; until: number; born: number } | null = null;
    let nightAmt = 0;
    let now = 0;
    let last = performance.now();
    let raf = 0;
    let waitUntil = 600;
    let dice: { label: string; color: string; spinning: boolean; until: number; sq: Squash } | null = null;
    let arrows: { id: string; x: number; y: number }[] = [];
    const cam = { x: disp[0].x, y: disp[0].y - 60, zoom: 1.25 };
    let bonusShown = 0;
    let minigameQueued = false;

    const confetti = (x: number, y: number, n: number, colors: string[]) => {
      const count = Math.round(n * (motion ? 1 : 0.3));
      for (let i = 0; i < count; i += 1) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const sp = 160 + Math.random() * 340;
        bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, color: colors[i % colors.length], r: 2 + Math.random() * 3 });
      }
    };
    const pushBanner = (text: string, color: string, ms = 1300, sub?: string) => banners.push({ text, color, ms, sub });
    const playerAnchor = (i: number) => ({ x: disp[i].x, y: disp[i].y });

    // Spread players sharing a node so nobody hides.
    const slotOffset = (i: number) => {
      const p = s.players[i];
      const same = s.players.filter((o) => o.node === p.node);
      if (same.length < 2) return { dx: 0, dy: 0 };
      const k = same.indexOf(p);
      const offs = [
        [-14, -4],
        [14, -4],
        [-10, 8],
        [10, 8],
      ];
      return { dx: offs[k][0], dy: offs[k][1] };
    };

    const startHop = (i: number, toNode: string, via: string) => {
      const n = s.map[toNode];
      const pt = P(n.x, n.y, n.z);
      const d = disp[i];
      d.fromX = d.x;
      d.fromY = d.y;
      d.toX = pt.x;
      d.toY = pt.y;
      d.start = now;
      d.dur = via === 'slide' ? 520 : via === 'ladder' ? 360 : HOP_MS;
      d.arc = via === 'ladder' || via === 'slide' ? 0 : via === 'stairs' ? 16 : 28;
      if (Math.abs(pt.x - d.x) > 2) d.facing = pt.x > d.x ? 1 : -1;
      squash[i].launch(0.7);
    };

    const handleEvents = (events: BoardEvent[]) => {
      for (const e of events) {
        switch (e.kind) {
          case 'turn-start': {
            const name = CHARACTERS_BY_ID[s.players[e.who].characterId]?.name ?? '';
            pushBanner(e.who === localSeat ? L.yourTurn : L.turn(name), LANE[e.who], 900, e.who === localSeat && e.round === 1 ? L.round(s.round, s.maxRounds) : undefined);
            break;
          }
          case 'roll': {
            const color = e.signature ? LANE[e.who] : '#ffcb3c';
            dice = { label: faceLabel(e.face), color, spinning: false, until: now + 900, sq: new Squash() };
            dice.sq.land(1.2);
            const a = playerAnchor(e.who);
            impact(juice, now, ...toScreen(a.x, a.y - 110), 0.55);
            juice.chimes.accent('crack');
            waitUntil = now + 700;
            break;
          }
          case 'hop':
            startHop(e.who, e.to, e.via);
            juice.chimes.pickup(now);
            waitUntil = now + (e.via === 'slide' ? 560 : e.via === 'ladder' ? 400 : HOP_MS + 40);
            break;
          case 'coins': {
            const a = playerAnchor(e.who);
            floats.push({ x: a.x, y: a.y - 90, text: `${e.delta > 0 ? '+' : ''}${e.delta}`, color: e.delta > 0 ? '#ffe27a' : '#ff6b8a', born: now, coin: true });
            if (e.delta > 0) {
              for (let k = 0; k < Math.min(6, e.delta); k += 1) setTimeout(() => juice.chimes.pickup(now + k * 70, { bright: true }), k * 70);
              confetti(a.x, a.y - 60, 6, ['#ffcf3c', '#fff6c4']);
            } else juice.chimes.accent('hit');
            break;
          }
          case 'crown-bought': {
            const a = playerAnchor(e.who);
            pushBanner(L.crownGet, '#ffcf3c', 1400);
            confetti(a.x, a.y - 80, 70, ['#ffcf3c', '#fff6c4', '#38d5ff', '#ff3fa4', '#5fe36f']);
            impact(juice, now, ...toScreen(a.x, a.y - 80), 1);
            juice.chimes.accent('bank');
            waitUntil = now + 1400;
            break;
          }
          case 'vendor-move':
            if (s.round > 1 || s.turnOf > 0) confetti(...vendorPos(), 20, ['#b56cff', '#ffcf3c']);
            break;
          case 'land': {
            const a = playerAnchor(e.who);
            squash[e.who].land(1);
            juice.camera.addTrauma(0.12 * motion);
            waitUntil = Math.max(waitUntil, now + 650);
            if (e.space === 'archon') {
              pushBanner(L.archon, '#e3264a', 1200);
              impact(juice, now, ...toScreen(a.x, a.y), 0.8);
            }
            break;
          }
          case 'item-got':
            pushBanner(L.gotItem(L.item(e.item)), '#5fe36f', 1100);
            break;
          case 'item-used':
            pushBanner(L.item(e.item), LANE[e.who], 900);
            break;
          case 'trap-sprung':
            pushBanner(L.trap, '#ff3fa4', 1100);
            impact(juice, now, ...toScreen(disp[e.who].x, disp[e.who].y), 0.7);
            break;
          case 'swap': {
            pushBanner(e.what === 'coins' ? L.swapCoins : L.swapPlaces, '#ff9a2f', 1200);
            if (e.what === 'places')
              for (const w of [e.a, e.b]) {
                const n = s.map[s.players[w].node];
                const pt = P(n.x, n.y, n.z);
                disp[w].fromX = disp[w].x;
                disp[w].fromY = disp[w].y;
                disp[w].toX = pt.x;
                disp[w].toY = pt.y;
                disp[w].start = now;
                disp[w].dur = 600;
                disp[w].arc = 120;
              }
            waitUntil = now + 900;
            break;
          }
          case 'freeze':
            pushBanner(L.frozen, '#bff3ff', 1100);
            break;
          case 'event':
            pushBanner(L.event(e.name), '#ffcb3c', 1500);
            if (e.name === 'gantry-lift') {
              const w = e.who;
              const n = s.map[s.players[w].node];
              const pt = P(n.x, n.y, n.z);
              Object.assign(disp[w], { fromX: disp[w].x, fromY: disp[w].y, toX: pt.x, toY: pt.y, start: now, dur: 700, arc: 160 });
            }
            waitUntil = now + 1300;
            break;
          case 'night':
            pushBanner(e.night ? L.night : L.day, e.night ? '#7ef3ff' : '#ffcf7a', 1500);
            if (e.night) getBackdrop(true);
            break;
          case 'overtime':
            pushBanner(L.overtime, '#ff3fa4', 1800);
            break;
          case 'minigame':
            pushBanner(L.minigame, '#7cff6b', 1500);
            minigameQueued = true;
            waitUntil = now + 1700;
            break;
          case 'bonus':
            break;
          case 'game-over':
            break;
        }
      }
    };

    const vendorPos = (): [number, number] => {
      const n = s.map[s.vendor];
      const pt = P(n.x, n.y, n.z);
      return [pt.x + 34, pt.y - 10];
    };

    // World -> CSS screen pixels (for refraction rings).
    const toScreen = (wx: number, wy: number): [number, number] => {
      const z = cam.zoom * juice.camera.zoomValue;
      return [W / 2 + (wx - cam.x) * z, H / 2 + (wy - cam.y) * z];
    };

    // ---- Online ordering: the host numbers every action; everyone applies them in order.
    const room = online?.room;
    const isHost = !!online?.host;
    let seq = 0;
    let nextApply = 1;
    const inbox = new Map<number, BoardAction>();
    const commit = (a: BoardAction) => {
      seq += 1;
      room?.send('apply', { seq, action: a });
      inbox.set(seq, a);
    };
    const applyNow = (a: BoardAction) => {
      boardAct(s, a);
      handleEvents(s.events);
      setSent(false);
      setUi((v) => v + 1);
    };
    actRef.current = (a: BoardAction) => {
      if (!online) return applyNow(a);
      if (isHost) return commit(a);
      room?.send('act', { seat: localSeat, action: a });
      setSent(true);
    };
    // Minigames online: everyone plays the same seed; the host combines the scores.
    let miniRound = 0;
    let hostBanked: Record<string, number> | null = null;
    const reports = new Map<number, number>();
    let miniDeadline = 0;
    let pendingResult: number[] | null = null;
    let localMiniDone = false;
    const applyMini = (placements: number[]) => {
      boardMinigameResult(s, placements);
      handleEvents(s.events);
      waitUntil = now + 500;
      pendingResult = null;
      localMiniDone = false;
      setWaitingOthers(false);
      setUi((v) => v + 1);
    };
    const tryFinishMini = (force = false) => {
      if (!isHost || !hostBanked || s.phase !== 'minigame') return;
      const guests = (seatsRef.current ?? []).filter((st) => st.kind === 'guest').map((st) => st.index);
      if (!force && guests.some((g) => !reports.has(g))) return;
      const banked = s.players.map((p, i) => (roleOf(i) === 'remote' ? reports.get(i) ?? 0 : hostBanked![p.characterId] ?? 0));
      const placements = minigamePlacements(banked);
      room?.send('mini-result', { round: miniRound, placements });
      hostBanked = null;
      reports.clear();
      applyMini(placements);
    };
    minigameDoneRef.current = (d: DropState) => {
      const res = dropResults(d);
      if (!online) {
        const placements = s.players.map((p) => res.find((r) => r.characterId === p.characterId)?.placement ?? 4);
        applyMini(placements);
        return;
      }
      const mine = res.find((r) => r.characterId === s.players[localSeat].characterId);
      localMiniDone = true;
      if (isHost) {
        hostBanked = Object.fromEntries(res.map((r) => [r.characterId, r.banked]));
        miniDeadline = now + 30_000;
        setWaitingOthers(true);
        tryFinishMini();
      } else {
        room?.send('mini-report', { round: miniRound, seat: localSeat, banked: mine?.banked ?? 0 });
        if (pendingResult) applyMini(pendingResult);
        else setWaitingOthers(true);
      }
    };
    // Presence: pings both ways; quiet guests become bots, a quiet host ends the party.
    const lastSeen = new Map<number, number>();
    let lastHost = 0;
    if (room) {
      room.setHandlers({
        onApply: (m) => {
          if (!isHost) inbox.set(m.seq, m.action);
        },
        onAct: (m) => {
          if (isHost && roleOf(m.seat) === 'remote') commit(m.action);
        },
        onMiniReport: (m) => {
          if (!isHost) return;
          reports.set(m.seat, m.banked);
          tryFinishMini();
        },
        onMiniResult: (m) => {
          if (isHost || m.round !== miniRound) return;
          if (localMiniDone) applyMini(m.placements);
          else pendingResult = m.placements;
        },
        onSeatBot: (m) => {
          if (seatsRef.current) seatsRef.current = seatToBot(seatsRef.current, m.seat);
          setUi((v) => v + 1);
        },
        onPing: (m) => {
          if (m.host) lastHost = now;
          else lastSeen.set(m.seat, now);
        },
        onLeave: (m) => {
          if (m.host && !isHost) setHostGone(true);
          else if (isHost) dropSeat(m.seat);
        },
      });
    }
    const dropSeat = (seat: number) => {
      if (!seatsRef.current || seatsRef.current[seat]?.kind !== 'guest') return;
      seatsRef.current = seatToBot(seatsRef.current, seat);
      room?.send('seat-bot', { seat });
      reports.delete(seat);
      tryFinishMini();
      setUi((v) => v + 1);
    };
    let pingAt = 0;
    const presence = () => {
      if (!room) return;
      if (now >= pingAt) {
        pingAt = now + 4000;
        room.send('ping', { seat: localSeat, host: isHost });
      }
      if (isHost) {
        for (const st of seatsRef.current ?? []) {
          if (st.kind !== 'guest') continue;
          const seen = lastSeen.get(st.index) ?? 0;
          if (!lastSeen.has(st.index)) lastSeen.set(st.index, now);
          else if (now - seen > 20_000) dropSeat(st.index);
        }
        if (hostBanked && now > miniDeadline) tryFinishMini(true);
      } else {
        if (!lastHost) lastHost = now;
        if (now - lastHost > 25_000) setHostGone(true);
      }
    };

    // Pace the game.
    const tick = () => {
      presence();
      if (now < waitUntil || banner) return;
      if (minigameQueued) {
        minigameQueued = false;
        miniRound = s.round;
        setMinigame((s.seed ^ (s.round * 7919)) >>> 0);
        return;
      }
      if (s.phase === 'minigame') return;
      if (s.phase === 'bonus') {
        if (bonusShown < s.bonus.length) {
          const b = s.bonus[bonusShown];
          const names = b.winners.map((w) => CHARACTERS_BY_ID[s.players[w].characterId]?.name ?? '').join(' + ');
          pushBanner(`${L.bonusTitle}: ${L.bonus(b.name)}`, '#ffcf3c', 2200, names || L.nobody);
          for (const w of b.winners) confetti(disp[w].x, disp[w].y - 80, 50, ['#ffcf3c', '#fff6c4']);
          juice.chimes.accent('bank');
          bonusShown += 1;
          return;
        }
        boardAdvance(s);
        handleEvents(s.events);
        return;
      }
      if (s.phase === 'over') {
        cancelAnimationFrame(raf);
        room?.send('leave', { seat: localSeat, host: isHost });
        finishRef.current(s, localSeat);
        return;
      }
      if (s.pending) {
        const role = roleOf(s.turnOf);
        // Online: ordered actions arrive in the inbox; apply the next one once we reach its turn.
        if (online) {
          const next = inbox.get(nextApply);
          if (next) {
            inbox.delete(nextApply);
            nextApply += 1;
            if (role !== 'local' && next.type === 'roll' && dice?.spinning) waitUntil = now + 120;
            applyNow(next);
            waitUntil = Math.max(waitUntil, now + (role === 'local' ? 60 : 380));
            return;
          }
        }
        if (role === 'local') return;
        if (s.pending.type === 'roll' && !dice) {
          dice = { label: '?', color: '#ffcb3c', spinning: true, until: now + 99999, sq: new Squash() };
          waitUntil = now + 650;
          return;
        }
        if (role === 'remote' || (online && !isHost)) return;
        const a = botAction(s);
        if (a) {
          if (online) commit(a);
          else applyNow(a);
          waitUntil = Math.max(waitUntil, now + 380);
        }
        return;
      }
      boardAdvance(s);
      handleEvents(s.events);
      setUi((v) => v + 1);
    };

    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      for (const a of arrows) {
        if (Math.hypot(a.x - x, a.y - y) < 42) {
          actRef.current({ type: 'junction', to: a.id });
          return;
        }
      }
      ensureAudio();
      // Screen -> world.
      const z = cam.zoom * juice.camera.zoomValue;
      const wx = cam.x + (x - W / 2) / z;
      const wy = cam.y + (y - H / 2) / z;
      const pan = Math.max(-1, Math.min(1, (x / W) * 2 - 1));
      // Players: a happy hop.
      for (let i = 0; i < s.players.length; i += 1) {
        const d = disp[i];
        if (Math.abs(wx - d.x) < 20 && wy < d.y + 6 && wy > d.y - 70) {
          if (d.start < 0) Object.assign(d, { fromX: d.x, fromY: d.y, toX: d.x, toY: d.y, start: now, dur: 360, arc: 34 });
          squash[i].launch(1);
          juice.chimes.pickup(now, { pan, bright: true });
          confetti(d.x, d.y - 40, 8, [LANE[i], '#ffffff']);
          return;
        }
      }
      // Lok the Owl: hoot and hop.
      const [ox, oy] = vendorPos();
      if (Math.abs(wx - ox) < 26 && wy < oy + 4 && wy > oy - 110) {
        owlHopAt = now;
        juice.chimes.accent('bank', pan);
        confetti(ox, oy - 60, 14, ['#8a5b3c', '#f3e2c3', '#ffcf3c']);
        return;
      }
      // Spaces: bounce and sing their note.
      for (const n of MONROE_LOOP.nodes) {
        const pt = P(n.x, n.y, n.z);
        if (((wx - pt.x) / 30) ** 2 + ((wy - pt.y) / 18) ** 2 < 1) {
          tileBounce.set(n.id, now);
          juice.chimes.pickup(now, { pan });
          return;
        }
      }
      // Buildings, front-most first: signs recolor, windows switch their light.
      const order = [...BUILDINGS].sort((a, b) => b.y1 - a.y1);
      for (const b of order) {
        if ((xray.get(b.seed) ?? 1) < 0.7) continue;
        if (b.sign) {
          const sr = signRect(b);
          if (wx > sr.x && wx < sr.x + sr.w && wy > sr.y && wy < sr.y + sr.h) {
            city.signs[b.seed] = ((city.signs[b.seed] ?? SIGN_COLORS.indexOf(b.sign.color)) + 1) % SIGN_COLORS.length;
            rebakeBuilding(b.seed);
            juice.chimes.accent('crack', pan);
            juice.waves.spawn(x, y, now, 0.4);
            confetti(wx, wy, 16, [SIGN_COLORS[city.signs[b.seed]], '#ffffff']);
            return;
          }
        }
        for (const w of windowRects(b)) {
          if (wx > w.x - 3 && wx < w.x + w.w + 3 && wy > w.y - 3 && wy < w.y + w.h + 3) {
            if (city.windows.has(w.key)) city.windows.delete(w.key);
            else city.windows.add(w.key);
            rebakeBuilding(b.seed);
            juice.chimes.pickup(now, { pan });
            confetti(w.x + w.w / 2, w.y + 7, 6, ['#ffd889', '#fff6c4']);
            return;
          }
        }
      }
      // Props: lamps switch, trees rustle, crates wobble, the rest jiggles.
      for (const pr of [...PROPS].sort((a, b) => propSortY(b) - propSortY(a))) {
        const h = propHit(pr);
        if (!h || Math.hypot(wx - h.x, wy - h.y) > h.r) continue;
        propReact.set(pr.id, now);
        if (pr.kind === 'lamp' && pr.lamp !== undefined) {
          if (city.lampsOff.has(pr.lamp)) city.lampsOff.delete(pr.lamp);
          else city.lampsOff.add(pr.lamp);
          juice.chimes.accent('hit', pan);
        } else if (pr.kind === 'tree') {
          confetti(h.x, h.y, 12, nightAmt > 0.5 ? ['#1d6b52', '#2b8a6b'] : ['#6f9a3a', '#a9c25a', '#f2c14e']);
          juice.chimes.pickup(now, { pan });
        } else if (pr.kind === 'crate') {
          confetti(h.x, h.y, 10, ['#b07a45', '#7a5230']);
          juice.chimes.accent('hit', pan);
        } else juice.chimes.pickup(now, { pan });
        return;
      }
      // River: ripples and a splash.
      const riverTop = P(0, 560, -0.7).y;
      const riverBot = P(0, 690, -0.7).y;
      if (wy > riverTop && wy < riverBot) {
        ripples.push({ x: wx, y: wy, born: now });
        if (ripples.length > 8) ripples.shift();
        confetti(wx, wy, 10, ['#bfe8ff', '#ffffff']);
        juice.chimes.pickup(now, { pan });
        return;
      }
      // Sky at night: a shooting star.
      if (wy < P(0, 20, 0).y && nightAmt > 0.4) {
        stars.push({ x: wx, y: wy, vx: 420, vy: 160, born: now });
        if (stars.length > 4) stars.shift();
        juice.chimes.accent('crack', pan);
      }
    };
    canvas.addEventListener('pointerdown', onDown);

    const frame = (ts: number) => {
      const dt = Math.min(100, ts - last);
      last = ts;
      now += dt;
      // Human roll: spinning block while waiting for the hit.
      if (s.pending?.type === 'roll' && roleOf(s.turnOf) === 'local' && !dice) dice = { label: '?', color: '#ffcb3c', spinning: true, until: now + 99999, sq: new Squash() };
      if (!banner && banners.length) {
        const b = banners.shift()!;
        banner = { ...b, until: now + b.ms, born: now };
      }
      if (banner && now >= banner.until) banner = null;
      tick();
      // Animations.
      disp.forEach((d, i) => {
        const off = slotOffset(i);
        if (d.start >= 0) {
          const k = Math.min(1, (now - d.start) / d.dur);
          const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
          d.x = d.fromX + (d.toX - d.fromX) * e;
          d.y = d.fromY + (d.toY - d.fromY) * e - Math.sin(Math.PI * k) * d.arc;
          if (k >= 1) {
            d.start = -1;
            squash[i].land(0.8);
          }
        } else {
          const n = s.map[s.players[i].node];
          const pt = P(n.x, n.y, n.z);
          d.x += (pt.x + off.dx - d.x) * 0.2;
          d.y += (pt.y + off.dy - d.y) * 0.2;
        }
        squash[i].step(dt);
      });
      const nightTarget = s.night ? 1 : 0;
      nightAmt += (nightTarget - nightAmt) * Math.min(1, dt / 500);
      if (dice) {
        dice.sq.step(dt);
        if (dice.spinning) dice.label = String(1 + (Math.floor(now / 55) % 10));
        if (now > dice.until) dice = null;
      }
      for (const b of bits) {
        b.life += dt;
        b.x += (b.vx * dt) / 1000;
        b.y += (b.vy * dt) / 1000;
        b.vy += (700 * dt) / 1000;
      }
      for (let i = bits.length - 1; i >= 0; i -= 1) if (bits[i].life > 1400) bits.splice(i, 1);
      for (let i = floats.length - 1; i >= 0; i -= 1) if (now - floats[i].born > 1300) floats.splice(i, 1);
      for (let i = stars.length - 1; i >= 0; i -= 1) if (now - stars[i].born > 1000) stars.splice(i, 1);
      for (let i = ripples.length - 1; i >= 0; i -= 1) if (now - ripples[i].born > 1400) ripples.splice(i, 1);
      juice.camera.step(dt);
      juice.waves.prune(now);

      // Camera.
      const portrait = H > W;
      if (overviewRef.current) {
        const z = Math.min(W / WORLD_W, H / (WORLD_H - 60)) * 0.98;
        cam.zoom += (z - cam.zoom) * 0.12;
        cam.x += (WORLD_W / 2 - cam.x) * 0.12;
        cam.y += (WORLD_H / 2 + 20 - cam.y) * 0.12;
      } else {
        const focus = disp[s.turnOf];
        const z = (portrait ? W / 620 : Math.min(W / 1000, H / 560)) * 1.05;
        cam.zoom += (z - cam.zoom) * 0.08;
        cam.x += (focus.x - cam.x) * 0.08;
        // Frame the mover a little above center so the thumb panel never covers them.
        cam.y += (focus.y + (H > W ? -10 : 40) / cam.zoom - cam.y) * 0.08;
        // Never show past the edge of the city.
        const hw = W / 2 / cam.zoom;
        const hh = H / 2 / cam.zoom;
        cam.x = WORLD_W > hw * 2 ? Math.min(WORLD_W - hw, Math.max(hw, cam.x)) : WORLD_W / 2;
        cam.y = WORLD_H > hh * 2 ? Math.min(WORLD_H - hh, Math.max(hh, cam.y)) : WORLD_H / 2;
      }
      draw();
      raf = requestAnimationFrame(frame);
    };

    const draw = () => {
      const pulse = juice.bus.pulse(getAudioContext()?.currentTime ?? now / 1000);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = nightAmt > 0.5 ? '#100e24' : '#7d6a6e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sh = juice.camera.shake();
      const z = cam.zoom * juice.camera.zoomValue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.translate(W / 2 + sh.dx, H / 2 + sh.dy);
      ctx.rotate(sh.rot);
      ctx.scale(z, z);
      ctx.translate(-cam.x, -cam.y);
      // City ground (crossfaded between moods), then live ground light.
      ctx.drawImage(getBackdrop(false), 0, 0, WORLD_W, WORLD_H);
      if (nightAmt > 0.01 && grounds.night) {
        ctx.globalAlpha = nightAmt;
        ctx.drawImage(grounds.night, 0, 0, WORLD_W, WORLD_H);
        ctx.globalAlpha = 1;
      }
      drawLiveGround(ctx, nightAmt, now, city);
      // River ripples from taps.
      for (const r of ripples) {
        const age = (now - r.born) / 1200;
        for (let k = 0; k < 3; k += 1) {
          const a = age - k * 0.15;
          if (a <= 0 || a >= 1) continue;
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - a)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, 8 + a * 60, 4 + a * 22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const pend = s.pending;
      const options = pend?.type === 'junction' ? pend.options : [];
      const mood = nightAmt > 0.5 ? MIDNIGHT : GOLDEN;
      const isNight = nightAmt > 0.5;
      const [ox, oy] = vendorPos();
      const vendorNode = s.map[s.vendor];
      // Points that must never hide behind a building: players, the owl, junction choices.
      const keep: { x: number; y: number; sort: number }[] = s.players.map((p, i) => ({ x: disp[i].x, y: disp[i].y - 30, sort: nodeSortY(s.map[p.node]) + 1 }));
      keep.push({ x: ox, y: oy - 40, sort: nodeSortY(vendorNode) + 1 });
      for (const id of options) {
        const n = s.map[id];
        const pt = P(n.x, n.y, n.z);
        keep.push({ x: pt.x, y: pt.y, sort: nodeSortY(n) });
      }
      type Ent = { sort: number; draw: () => void };
      const ents: Ent[] = [];
      for (const b of BUILDINGS) {
        const sp = sprite(`b${b.seed}`, false, () => bakeBuilding(b, GOLDEN, bakeScale, city));
        const hidden = keep.some((k) => k.sort < b.y1 && k.x > sp.x + 6 && k.x < sp.x + sp.w - 40 && k.y > sp.y + 70 && k.y < sp.y + sp.h);
        const cur = xray.get(b.seed) ?? 1;
        const alpha = cur + ((hidden ? 0.38 : 1) - cur) * 0.15;
        xray.set(b.seed, alpha);
        ents.push({
          sort: b.y1,
          draw: () => {
            ctx.globalAlpha = alpha;
            ctx.drawImage(sp.canvas, sp.x, sp.y, sp.w, sp.h);
            if (nightAmt > 0.01) {
              const sn = sprite(`b${b.seed}`, true, () => bakeBuilding(b, MIDNIGHT, bakeScale, city));
              ctx.globalAlpha = alpha * nightAmt;
              ctx.drawImage(sn.canvas, sn.x, sn.y, sn.w, sn.h);
            }
            ctx.globalAlpha = 1;
          },
        });
      }
      for (const [key, sortY, make] of [
        ['gantry', GANTRY_SORT, (m: typeof GOLDEN) => bakeGantry(m, bakeScale)],
        ['slide', SLIDE_SORT, (m: typeof GOLDEN) => bakeSlide(m, bakeScale)],
      ] as const) {
        ents.push({
          sort: sortY,
          draw: () => {
            const sd = sprite(key, false, () => make(GOLDEN));
            ctx.drawImage(sd.canvas, sd.x, sd.y, sd.w, sd.h);
            if (nightAmt > 0.01) {
              const sn = sprite(key, true, () => make(MIDNIGHT));
              ctx.globalAlpha = nightAmt;
              ctx.drawImage(sn.canvas, sn.x, sn.y, sn.w, sn.h);
              ctx.globalAlpha = 1;
            }
          },
        });
      }
      for (const pr of PROPS) {
        const at = propReact.get(pr.id);
        const react = at === undefined ? 0 : Math.max(0, 1 - (now - at) / 700);
        ents.push({ sort: propSortY(pr), draw: () => drawProp(ctx, pr, mood, city, react) });
      }
      for (const n of MONROE_LOOP.nodes) {
        for (const tId of n.next) {
          const m = s.map[tId];
          ents.push({ sort: Math.max(nodeSortY(n), nodeSortY(m)) - 0.5, draw: () => drawEdge(ctx, n, m, n.via?.[tId] ?? 'walk', mood) });
        }
        const bAt = tileBounce.get(n.id);
        const bounce = bAt === undefined ? 0 : Math.min(1, (now - bAt) / 380);
        ents.push({ sort: nodeSortY(n), draw: () => drawSpace(ctx, n, now, { highlight: options.includes(n.id), trap: s.traps[n.id] !== undefined, night: nightAmt, bounce: bounce >= 1 ? 0 : bounce }) });
      }
      // Trail of the current move.
      if (s.phase === 'move' && s.trail.length > 1)
        ents.push({
          sort: nodeSortY(s.map[s.players[s.turnOf].node]) + 0.2,
          draw: () => {
            ctx.strokeStyle = rgba(LANE[s.turnOf], 0.6);
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            s.trail.forEach((id, i) => {
              const n = s.map[id];
              const pt = P(n.x, n.y, n.z);
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
            ctx.lineCap = 'butt';
          },
        });
      const owlLift = Math.max(0, Math.sin(Math.min(1, (now - owlHopAt) / 450) * Math.PI)) * 18;
      ents.push({
        sort: nodeSortY(vendorNode) + 0.8,
        draw: () => {
          const g = ctx.createRadialGradient(ox, oy, 4, ox, oy, 70);
          g.addColorStop(0, `rgba(255,207,60,${0.25 + 0.15 * pulse})`);
          g.addColorStop(1, 'rgba(255,207,60,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(ox, oy, 70, 34, 0, 0, Math.PI * 2);
          ctx.fill();
          drawOwl(ctx, ox, oy - owlLift, 0.72, now);
        },
      });
      s.players.forEach((p, i) => {
        const d = disp[i];
        ents.push({
          sort: nodeSortY(s.map[p.node]) + 1 + i * 0.01,
          draw: () => {
            const def = CHARACTERS_BY_ID[p.characterId];
            const active = i === s.turnOf;
            ctx.strokeStyle = rgba(LANE[i], active ? 0.95 : 0.6);
            ctx.lineWidth = active ? 3 : 2;
            ctx.beginPath();
            ctx.ellipse(d.x, d.y, 20, 10, 0, 0, Math.PI * 2);
            ctx.stroke();
            drawShadow(ctx, d.x, d.y + 1, 15);
            if (def) {
              ctx.save();
              ctx.translate(d.x, d.y);
              ctx.scale(squash[i].scaleX, squash[i].scaleY);
              const moving = d.start >= 0;
              drawRig(ctx, def.rig, def.palette, moving ? 'walk' : 'idle', now + i * 300, 0, 0, d.facing, RIG_SCALE, { outline: true, flash: p.frozen && Math.floor(now / 200) % 2 === 0 });
              ctx.restore();
            }
            if (active && s.phase === 'move' && s.stepsLeft > 0) {
              const hy = d.y - (def?.rig.pixelHeight ?? 40) * RIG_SCALE - 30;
              ctx.fillStyle = CREAM;
              ctx.strokeStyle = ESPRESSO;
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(d.x, hy, 15, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = ESPRESSO;
              ctx.font = '900 17px ui-sans-serif, system-ui';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(s.stepsLeft), d.x, hy + 1);
            }
          },
        });
      });
      ents.sort((a, b) => a.sort - b.sort);
      for (const e of ents) e.draw();
      drawLiveAir(ctx, nightAmt, now, pulse, city);
      // Shooting stars from sky taps.
      for (const st of stars) {
        const age = (now - st.born) / 1000;
        const x = st.x + st.vx * age;
        const y = st.y + st.vy * age;
        const g = ctx.createLinearGradient(x, y, x - st.vx * 0.15, y - st.vy * 0.15);
        g.addColorStop(0, `rgba(255,255,255,${1 - age})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - st.vx * 0.15, y - st.vy * 0.15);
        ctx.stroke();
      }
      void isNight;
      // Dice block over the current player.
      if (dice) {
        const d = disp[s.turnOf];
        const def = CHARACTERS_BY_ID[s.players[s.turnOf].characterId];
        const hy = d.y - (def?.rig.pixelHeight ?? 40) * RIG_SCALE - 70 + Math.sin(now / 160) * 4;
        drawDiceBlock(ctx, d.x, hy, 58, dice.label, dice.color, now, { x: dice.sq.scaleX, y: dice.sq.scaleY });
      }
      // Floating numbers.
      for (const f of floats) {
        const age = (now - f.born) / 1300;
        const y = f.y - age * 50;
        ctx.globalAlpha = Math.max(0, 1 - age * age);
        if (f.coin) drawCoin(ctx, f.x - 22, y, 9, now, true);
        ctx.font = '900 22px ui-sans-serif, system-ui';
        ctx.textAlign = f.coin ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1a1020';
        ctx.strokeText(f.text, f.coin ? f.x - 10 : f.x, y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.coin ? f.x - 10 : f.x, y);
        ctx.globalAlpha = 1;
      }
      for (const b of bits) {
        ctx.globalAlpha = Math.max(0, 1 - b.life / 1400);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.r * 2, b.r);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // Junction arrows in screen space (big, tappable).
      arrows = [];
      if (options.length && roleOf(s.turnOf) === 'local' && !sentRef.current) {
        const here = s.map[s.players[s.turnOf].node];
        const hp = P(here.x, here.y, here.z);
        for (const id of options) {
          const n = s.map[id];
          const pt = P(n.x, n.y, n.z);
          const [sx, sy] = toScreen(pt.x, pt.y - 40);
          const [hx, hy] = toScreen(hp.x, hp.y);
          const ang = Math.atan2(sy - hy, sx - hx);
          const bob = Math.sin(now / 150) * 4;
          const ax = sx + Math.cos(ang) * bob;
          const ay = sy + Math.sin(ang) * bob;
          arrows.push({ id, x: ax, y: ay });
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(ang);
          ctx.fillStyle = CREAM;
          ctx.strokeStyle = ESPRESSO;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(26, 0);
          ctx.lineTo(-6, -22);
          ctx.lineTo(-6, -10);
          ctx.lineTo(-24, -10);
          ctx.lineTo(-24, 10);
          ctx.lineTo(-6, 10);
          ctx.lineTo(-6, 22);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = LANE[0];
          ctx.fillRect(-20, -4, 18, 8);
          ctx.restore();
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, now, dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawHud(pulse);
    };

    const drawHud = (pulse: number) => {
      const portrait = H > W;
      const k = H < 520 || W < 420 ? 0.74 : 1;
      const cardH = 64;
      const cardW = portrait ? (W - 24) / 2 / k : 200;
      const cw = cardW * k;
      const ch = cardH * k;
      s.players.forEach((p, i) => {
        let X: number;
        let Y: number;
        if (portrait) {
          X = 8 + (i % 2) * (cw + 8);
          Y = 8 + Math.floor(i / 2) * (ch + 8);
        } else {
          X = i < 2 ? 10 + i * (cw + 8) : W - 10 - (4 - i) * (cw + 8);
          Y = 8;
        }
        const active = i === s.turnOf && s.phase !== 'minigame';
        ctx.save();
        ctx.translate(X, Y + (active ? Math.sin(now / 200) * 1.5 : 0));
        ctx.scale(k, k);
        const x = 0;
        const y = 0;
        // Card body.
        ctx.fillStyle = ESPRESSO;
        ctx.beginPath();
        ctx.roundRect(x, y + 4, cardW, cardH, 12);
        ctx.fill();
        ctx.fillStyle = CREAM;
        ctx.strokeStyle = active ? LANE[i] : ESPRESSO;
        ctx.lineWidth = active ? 4 : 3;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 12);
        ctx.fill();
        ctx.stroke();
        // Lane tab.
        ctx.fillStyle = LANE[i];
        ctx.beginPath();
        ctx.roundRect(x + 6, y + 6, 6, cardH - 12, 3);
        ctx.fill();
        // Portrait medallion.
        const px = x + 40;
        const py = y + cardH / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, 22, 0, Math.PI * 2);
        const pg = ctx.createRadialGradient(px - 6, py - 8, 2, px, py, 24);
        pg.addColorStop(0, rgba(LANE[i], 0.55));
        pg.addColorStop(1, '#1a1238');
        ctx.fillStyle = pg;
        ctx.fill();
        ctx.clip();
        const def = CHARACTERS_BY_ID[p.characterId];
        if (def) drawRig(ctx, def.rig, def.palette, 'idle', now + i * 200, px, py + def.rig.pixelHeight * 1.05 * 0.55, 1, 1.05 * 1.7);
        ctx.restore();
        ctx.strokeStyle = ESPRESSO;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, 22, 0, Math.PI * 2);
        ctx.stroke();
        // Name and counts.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = ESPRESSO;
        ctx.font = '800 12px ui-sans-serif, system-ui';
        ctx.fillText((def?.name ?? '').slice(0, 13), x + 68, y + 20);
        drawCrown(ctx, x + 78, y + 39, 16, now, true);
        ctx.font = '900 17px ui-sans-serif, system-ui';
        ctx.fillText(String(p.crowns), x + 90, y + 45);
        drawCoin(ctx, x + 120, y + 39, 8);
        ctx.fillText(String(p.coins), x + 132, y + 45);
        // Item slots.
        for (let k = 0; k < 3; k += 1) {
          const ix = x + 70 + k * 18;
          const iy = y + 50;
          ctx.strokeStyle = 'rgba(59,42,32,0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ix, iy, 14, 9);
          if (p.items[k]) drawItemIcon(ctx, p.items[k], ix + 7, iy + 4.5, 0.4);
        }
        if (p.frozen) {
          ctx.fillStyle = 'rgba(191,243,255,0.35)';
          ctx.beginPath();
          ctx.roundRect(x, y, cardW, cardH, 12);
          ctx.fill();
        }
        ctx.restore();
      });
      // Round plaque with sun or moon (drops below the cards when the middle is too tight).
      const text = L.round(Math.min(s.round, s.maxRounds), s.maxRounds);
      ctx.font = '900 15px ui-sans-serif, system-ui';
      const tw = ctx.measureText(text).width + 56;
      const middle = W - 4 * (cw + 8) - 20;
      const portraitTop = portrait ? 2 * (ch + 8) + 12 : middle > tw + 10 ? 10 : ch + 18;
      const px = W / 2;
      const ot = isOvertime(s);
      ctx.fillStyle = ESPRESSO;
      ctx.beginPath();
      ctx.roundRect(px - tw / 2, portraitTop + 4, tw, 34, 17);
      ctx.fill();
      ctx.fillStyle = ot ? '#ffe0ef' : CREAM;
      ctx.strokeStyle = ot ? '#ff3fa4' : ESPRESSO;
      ctx.lineWidth = ot ? 3 + 2 * pulse : 3;
      ctx.beginPath();
      ctx.roundRect(px - tw / 2, portraitTop, tw, 34, 17);
      ctx.fill();
      ctx.stroke();
      const ix = px - tw / 2 + 20;
      const iy = portraitTop + 17;
      if (nightAmt > 0.5) {
        ctx.fillStyle = '#5a5fd8';
        ctx.beginPath();
        ctx.arc(ix, iy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ot ? '#ffe0ef' : CREAM;
        ctx.beginPath();
        ctx.arc(ix + 4, iy - 3, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffb03c';
        ctx.beginPath();
        ctx.arc(ix, iy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb03c';
        ctx.lineWidth = 2;
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 + now / 2000;
          ctx.beginPath();
          ctx.moveTo(ix + Math.cos(a) * 8, iy + Math.sin(a) * 8);
          ctx.lineTo(ix + Math.cos(a) * 11, iy + Math.sin(a) * 11);
          ctx.stroke();
        }
      }
      ctx.fillStyle = ESPRESSO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, px + 10, portraitTop + 18);
      // Banner: a slanted ribbon that slams in.
      if (banner) {
        const age = now - banner.born;
        const inK = Math.min(1, age / 180);
        const outK = Math.max(0, 1 - (banner.until - now) / 200);
        const slide = (1 - inK) * -W + outK * W;
        const by = H * 0.38;
        ctx.save();
        ctx.translate(W / 2 + slide, by);
        ctx.rotate(-0.04);
        ctx.font = '900 30px ui-sans-serif, system-ui';
        const bw = Math.min(W - 20, ctx.measureText(banner.text).width + 80);
        ctx.fillStyle = '#1a1020';
        ctx.beginPath();
        ctx.moveTo(-bw / 2 - 14, -26);
        ctx.lineTo(bw / 2 + 4, -26);
        ctx.lineTo(bw / 2 + 14, 28);
        ctx.lineTo(-bw / 2 - 4, 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = banner.color;
        ctx.beginPath();
        ctx.moveTo(-bw / 2 - 8, -22);
        ctx.lineTo(bw / 2, -22);
        ctx.lineTo(bw / 2 + 8, 22);
        ctx.lineTo(-bw / 2, 22);
        ctx.closePath();
        ctx.fill();
        // Speed stripes.
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let k = 0; k < 4; k += 1) ctx.fillRect(-bw / 2 + 10 + k * 14 + ((age / 6) % 14), -22, 5, 44);
        ctx.fillStyle = '#1a1020';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(banner.text, 0, 1);
        if (banner.sub) {
          ctx.font = '800 15px ui-sans-serif, system-ui';
          ctx.fillStyle = CREAM;
          ctx.strokeStyle = '#1a1020';
          ctx.lineWidth = 4;
          ctx.strokeText(banner.sub, 0, 42);
          ctx.fillText(banner.sub, 0, 42);
        }
        ctx.restore();
      }
    };

    handleEvents(s.events);
    raf = requestAnimationFrame(frame);
    const onUnload = () => room?.send('leave', { seat: localSeat, host: isHost });
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one game per mount
  }, [getAudioContext]);

  const s = stateRef.current;
  const me = s.players[localSeat];
  const myTurn = s.turnOf === localSeat && !!s.pending && s.phase !== 'minigame' && !sent;
  const pend = myTurn ? s.pending : null;
  const act = useCallback((a: BoardAction) => actRef.current(a), []);
  const sigFaces = SIGNATURE_DICE[me.characterId];
  const compact = typeof window !== 'undefined' && window.innerHeight < 520 && window.innerWidth > window.innerHeight;
  void ui;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05041a]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {pend ? (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 flex p-3 ${compact ? 'justify-end pb-3' : 'justify-center pb-6'}`}>
          <div className={`pointer-events-auto w-full rounded-2xl border-[3px] ${compact ? 'max-w-[340px] p-2' : 'max-w-md p-3'}`} style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 5px 0 ${ESPRESSO}` }}>
            {pend.type === 'item' ? (
              <>
                <div className="mb-2 text-xs font-black uppercase tracking-widest">{t('lokParty.board.itemPrompt')}</div>
                <div className="flex flex-wrap gap-2">
                  {me.items.map((it, i) => (
                    <PartyButton key={`${it}-${i}`} onPress={() => act({ type: 'use-item', item: it })}>
                      <ItemBadge item={it} />
                      {t(`lokParty.item.${it}` as MessageKey)}
                    </PartyButton>
                  ))}
                  <PartyButton tone="plain" onPress={() => act({ type: 'use-item', item: null })}>
                    {t('lokParty.board.skip')}
                  </PartyButton>
                </div>
              </>
            ) : null}
            {pend.type === 'roll' ? (
              <div className="flex gap-2">
                <PartyButton tone="gold" big={!compact} onPress={() => act({ type: 'roll', signature: false })}>
                  {t('lokParty.board.hit')}
                  <span className="block text-[10px] font-bold opacity-70">{t('lokParty.board.standard')}</span>
                </PartyButton>
                {sigFaces && me.customValue === null ? (
                  <PartyButton tone="lane" big={!compact} onPress={() => act({ type: 'roll', signature: true })}>
                    {t('lokParty.board.signature')}
                    <span className="block text-[10px] font-bold opacity-80">{sigFaces.map(faceLabel).join(' ')}</span>
                  </PartyButton>
                ) : null}
              </div>
            ) : null}
            {pend.type === 'custom-dice' ? (
              <>
                <div className="mb-2 text-xs font-black uppercase tracking-widest">{t('lokParty.board.custom')}</div>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((v) => (
                    <PartyButton key={v} tone="gold" onPress={() => act({ type: 'custom', value: v })}>
                      {v}
                    </PartyButton>
                  ))}
                </div>
              </>
            ) : null}
            {pend.type === 'crown' ? (
              <>
                <div className="mb-2 text-sm font-bold">{t('lokParty.board.crownPrompt')}</div>
                <div className="flex gap-2">
                  <PartyButton tone="gold" big onPress={() => act({ type: 'crown', buy: true })}>
                    {t('lokParty.board.buy')}
                    <span className="block text-[10px] font-bold opacity-70">-{CROWN_COST}</span>
                  </PartyButton>
                  <PartyButton tone="plain" onPress={() => act({ type: 'crown', buy: false })}>
                    {t('lokParty.board.pass')}
                  </PartyButton>
                </div>
              </>
            ) : null}
            {pend.type === 'junction' ? <div className="text-center text-sm font-black uppercase tracking-widest">{t('lokParty.board.junction')}</div> : null}
          </div>
        </div>
      ) : null}
      <div className="absolute bottom-4 left-4 flex gap-2" style={{ bottom: pend ? undefined : 16, top: pend ? undefined : undefined }}>
        <button type="button" onPointerDown={() => setOverview((v) => !v)} className="rounded-full border-[3px] px-4 py-2 text-xs font-black uppercase" style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, display: pend ? 'none' : undefined }}>
          {overview ? t('lokParty.board.follow') : t('lokParty.board.map')}
        </button>
        <button type="button" onPointerDown={onQuit} className="rounded-full border-[3px] px-4 py-2 text-xs font-black uppercase" style={{ background: 'transparent', borderColor: CREAM, color: CREAM, display: pend ? 'none' : undefined }}>
          {t('lokParty.drop.back')}
        </button>
      </div>
      {waitingOthers && minigame === null ? (
        <div className="absolute inset-x-0 top-1/3 flex justify-center">
          <div className="rounded-2xl border-[3px] px-5 py-3 text-sm font-black" style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO }}>
            {t('lokParty.online.waiting')}
          </div>
        </div>
      ) : null}
      {hostGone ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-sm rounded-2xl border-[3px] p-4 text-center" style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO }}>
            <div className="text-lg font-black">{t('lokParty.online.hostLeft')}</div>
            <button type="button" onPointerDown={onQuit} className="mt-3 w-full rounded-xl border-[3px] py-3 font-black" style={{ background: '#ffcf3c', borderColor: ESPRESSO }}>
              {t('lokParty.drop.back')}
            </button>
          </div>
        </div>
      ) : null}
      {minigame !== null ? (
        <div className="fixed inset-0 z-40 bg-[#07061a]">
          <DropArena
            seed={minigame}
            playerId={s.players[localSeat].characterId}
            durationMs={30_000}
            ladderTier={ladderTier}
            getAudioContext={getAudioContext}
            onDone={(d) => {
              setMinigame(null);
              minigameDoneRef.current(d);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function PartyButton({ children, onPress, tone = 'cream', big = false }: { children: React.ReactNode; onPress: () => void; tone?: 'cream' | 'gold' | 'lane' | 'plain'; big?: boolean }) {
  const bg = { cream: '#efe5d0', gold: '#ffcf3c', lane: '#38f2ff', plain: 'transparent' }[tone];
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className={`flex flex-1 flex-col items-center justify-center rounded-xl border-[3px] font-black transition-transform active:translate-y-[3px] ${big ? 'min-h-[64px] text-lg' : 'min-h-[44px] text-sm'}`}
      style={{ background: bg, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: tone === 'plain' ? 'none' : `0 3px 0 ${ESPRESSO}` }}
    >
      {children}
    </button>
  );
}

function ItemBadge({ item }: { item: ItemId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawItemIcon(ctx, item, c.width / 2, c.height / 2, 1);
  }, [item]);
  return <canvas ref={ref} width={36} height={28} style={{ width: 36, height: 28 }} />;
}

/** Original item icons, drawn in about a 34 x 24 box at scale 1. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, item: ItemId, x: number, y: number, k: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#1a1020';
  switch (item) {
    case 'double-dice':
      for (const [dx, col] of [
        [-7, '#ffcb3c'],
        [6, '#ff9a2f'],
      ] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(dx - 7, -7 + (dx > 0 ? 3 : -2), 14, 14, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1a1020';
        ctx.fillRect(dx - 1.5, -1.5 + (dx > 0 ? 3 : -2), 3, 3);
      }
      break;
    case 'custom-dice':
      ctx.fillStyle = '#38d5ff';
      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3, -3);
      ctx.lineTo(4, 4);
      ctx.moveTo(4, -3);
      ctx.lineTo(4, 4);
      ctx.lineTo(-3, 4);
      ctx.stroke();
      break;
    case 'swap-mirror':
      ctx.fillStyle = '#bfe8ff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, -3);
      ctx.lineTo(5, -3);
      ctx.lineTo(2, -6);
      ctx.moveTo(5, 3);
      ctx.lineTo(-5, 3);
      ctx.lineTo(-2, 6);
      ctx.stroke();
      break;
    case 'glitch-trap':
      ctx.fillStyle = '#ff3fa4';
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 5 : 10;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'crown-radar':
      ctx.strokeStyle = '#5fe36f';
      for (const r of [4, 8, 12]) {
        ctx.beginPath();
        ctx.arc(-6, 6, r, -Math.PI / 2, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffcf3c';
      ctx.beginPath();
      ctx.arc(-6, 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
