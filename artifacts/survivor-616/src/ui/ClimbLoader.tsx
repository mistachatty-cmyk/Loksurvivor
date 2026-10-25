/**
 * A loading screen you can play: wall-jump up the gap between two skyscrapers under a night sky. Tap, click or press
 * space to leap to the other wall; between leaps you slide down, so keep moving. Signs and vents jut out of the
 * walls: leap into one and you tumble to the bottom and start again. Height is counted in metres and the best is
 * kept on this device. The player's own operator climbs, with their LokPet scrambling along behind.
 * Procedural canvas art only, nothing is saved but the best height, and it stops drawing while the page is hidden.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { lokPetSpritePalette } from '@/game/data/lokPets';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';
import { evolvedRig, petEvolvedLook } from '@/game/engine/petEvolution';
import { drawRig } from '@/game/render/sprite';
import { useMeta } from '@/game/state/metaStore';
import type { CharacterDef } from '@/game/types';
import { useT } from '@/lib/i18n';
import { advanceClimb, createClimb, hazardsAround, newClimbRun, type ClimbState } from '@/lib/climbGame';

interface Props {
  character?: CharacterDef | null;
  title: string;
  status: string;
  /** 0..1 while known; null shows a gentle moving bar. */
  progress?: number | null;
  ready?: boolean;
  onEnter?: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

const BEST_KEY = 'survivor616.climb.best.v1';
const CHAR_SCALE = 1.7;

function readBest(): number {
  try { return Number(window.localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function writeBest(metres: number): void {
  try { window.localStorage.setItem(BEST_KEY, String(Math.floor(metres))); } catch { /* the best lasts until the page closes */ }
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function ClimbLoader({ character, title, status, progress = null, ready = false, onEnter, onCancel, cancelLabel }: Props) {
  const t = useT();
  const { meta } = useMeta();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leapQueued = useRef(false);
  const [height, setHeight] = useState(0);
  const [best, setBest] = useState(() => readBest());
  const [fallen, setFallen] = useState<number | null>(null);

  // The operator wears whatever look they have equipped; the LokPet is the starter, or the first one chosen for runs.
  const look = useMemo(() => {
    if (!character) return null;
    const palette = resolveCharacterCosmeticPalette(
      character,
      meta.characterSkinByCharacterId[character.id],
      meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId),
      meta.worldPaletteBlendEnabled,
    );
    return { rig: character.rig, palette };
  }, [character, meta.characterSkinByCharacterId, meta.activePaletteId, meta.worldPaletteBlendEnabled]);
  const petLook = useMemo(() => {
    const pet = meta.savedLokPets.find((p) => p.starter) ?? meta.savedLokPets.find((p) => meta.selectedLokPetIds.includes(p.id));
    if (!pet) return null;
    const evolved = petEvolvedLook(pet);
    return { rig: evolvedRig(pet.roll.silhouette, evolved.overlays), palette: lokPetSpritePalette(evolved.palette), size: (pet.roll.sizeScale ?? 1) * evolved.scale };
  }, [meta.savedLokPets, meta.selectedLokPetIds]);

  const live = useRef({ progress, ready, look, petLook });
  live.current = { progress, ready, look, petLook };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ([' ', 'arrowup', 'arrowleft', 'arrowright', 'w', 'a', 'd'].includes(event.key.toLowerCase())) {
        leapQueued.current = true;
        if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    let width = 1;
    let height_ = 1;
    let game: ClimbState = createClimb(newClimbRun(), 260);
    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let shownHeight = -1;
    let runBest = readBest();
    let petX = 0;
    let petY = 0;
    let fallTimer = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height_ = Math.max(1, rect.height);
      const bw = Math.round(width * ratio);
      const bh = Math.round(height_ * ratio);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      ctx.setTransform(bw / width, 0, 0, bh / height_, 0, 0);
      const gap = Math.max(190, Math.min(width * 0.62, 280));
      if (game.gap !== gap) game = createClimb(game.seed, gap);
    };
    resize();
    petX = game.x; petY = game.y;

    const draw = () => {
      const { progress: p, ready: isReady, look: me, petLook: pet } = live.current;
      const left = (width - game.gap) / 2;
      const right = left + game.gap;
      const camY = game.camY;
      // Screen y for a world y (world y grows downward; the camera follows the climber up).
      const sy = (wy: number) => wy - camY + height_ * 0.62;
      const climbed = Math.max(0, -game.bestY);
      const space = Math.min(1, climbed / 6000);

      // Night sky, darker the higher you get.
      const sky = ctx.createLinearGradient(0, 0, 0, height_);
      sky.addColorStop(0, `rgb(${Math.round(8 - 4 * space)},${Math.round(10 - 5 * space)},${Math.round(30 - 8 * space)})`);
      sky.addColorStop(0.55, `rgb(${Math.round(28 - 10 * space)},${Math.round(18 - 6 * space)},${Math.round(64 - 16 * space)})`);
      sky.addColorStop(1, `rgb(${Math.round(92 - 50 * space)},${Math.round(42 - 24 * space)},${Math.round(108 - 40 * space)})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height_);

      // Stars (twinkle), a few more of them with height.
      const starCount = 70 + Math.round(60 * space);
      for (let i = 0; i < starCount; i += 1) {
        const x = hash(i) * width;
        const y = ((hash(i + 40) * height_ * 1.4 + camY * 0.04 * (0.4 + hash(i + 7))) % (height_ * 1.4)) - height_ * 0.2;
        const tw = 0.45 + 0.55 * Math.sin(clock * (1 + hash(i + 3) * 2) + i);
        ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.6 * tw * (0.5 + 0.5 * hash(i + 11))})`;
        const size = hash(i + 19) > 0.9 ? 2.4 : 1.4;
        ctx.fillRect(x, y, size, size);
      }

      // The moon, drifting down slowly as you climb past it.
      const mx = width * 0.5 + game.gap * 0.18;
      const my = height_ * 0.22 + camY * 0.03;
      const mr = Math.min(width, height_) * 0.13;
      const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3);
      halo.addColorStop(0, 'rgba(255,244,214,0.35)'); halo.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = halo; ctx.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(214,196,150,0.55)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.2], [0.25, 0.1, 0.28], [-0.1, 0.35, 0.14], [0.3, -0.35, 0.1]] as const) { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); ctx.fill(); }

      // A far skyline that sinks away as you rise.
      const skylineY = height_ * 0.9 + camY * 0.12;
      ctx.fillStyle = 'rgba(20,14,48,0.9)';
      for (let i = -1; i < width / 38 + 2; i += 1) {
        const bh = 50 + hash(i * 1.3) * 90;
        ctx.fillRect(i * 38, skylineY - bh, 34, bh + height_);
      }

      // The two towers: a lit facade with floors, windows and a bright edge on the shaft side.
      const drawTower = (x0: number, x1: number, edgeX: number, seed: number) => {
        const fill = ctx.createLinearGradient(x0, 0, x1, 0);
        fill.addColorStop(0, '#0e0b24'); fill.addColorStop(1, '#241b4d');
        if (x0 > edgeX) { fill.addColorStop(0, '#241b4d'); fill.addColorStop(1, '#0e0b24'); }
        ctx.fillStyle = fill; ctx.fillRect(x0, 0, x1 - x0, height_);
        const floor = 44;
        const first = Math.floor((camY - height_ * 0.7) / floor);
        const last2 = Math.ceil((camY + height_ * 0.5) / floor);
        for (let f = first; f <= last2; f += 1) {
          const y = sy(f * floor);
          ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x0, y, x1 - x0, 2);
          for (let w = 0; w < 9; w += 1) {
            const wx = edgeX > x0 ? edgeX - 14 - w * 26 : edgeX + 6 + w * 26;
            if (wx < x0 - 12 || wx > x1) continue;
            const lit = hash(f * 9.1 + w * 3.3 + seed) < 0.38;
            ctx.fillStyle = lit ? `rgba(255,${200 + Math.round(hash(f + w) * 40)},130,${0.55 + 0.25 * Math.sin(clock * 0.7 + f)})` : 'rgba(80,90,150,0.18)';
            ctx.fillRect(wx, y + 12, 14, 18);
          }
        }
        ctx.fillStyle = 'rgba(190,200,255,0.55)'; ctx.fillRect(edgeX > x0 ? edgeX - 3 : edgeX, 0, 3, height_);
      };
      drawTower(0, left, left, 1);
      drawTower(right, width, right, 2);

      // Things sticking out of the walls.
      for (const hz of hazardsAround(game)) {
        const y = sy(hz.y);
        if (y < -80 || y > height_ + 80) continue;
        const x = hz.side === 'left' ? left : right - hz.depth;
        ctx.fillStyle = hz.kind === 'sign' ? '#f43f5e' : '#64748b';
        ctx.fillRect(x, y, hz.depth, hz.h);
        ctx.fillStyle = hz.kind === 'sign' ? '#ffe4e6' : '#0f172a';
        if (hz.kind === 'sign') ctx.fillRect(x + 4, y + 4, hz.depth - 8, hz.h - 8);
        else for (let g = 4; g < hz.h - 3; g += 6) ctx.fillRect(x + 3, y + g, hz.depth - 6, 2);
        if (hz.kind === 'sign') { const glow = ctx.createRadialGradient(x + hz.depth / 2, y + hz.h / 2, 2, x + hz.depth / 2, y + hz.h / 2, 46); glow.addColorStop(0, 'rgba(244,63,94,0.35)'); glow.addColorStop(1, 'rgba(244,63,94,0)'); ctx.fillStyle = glow; ctx.fillRect(x - 40, y - 40, hz.depth + 80, hz.h + 80); }
      }

      // The LokPet scrambles along a beat behind.
      const px = left + game.x;
      const py = sy(game.y);
      if (pet) {
        petX += (px + (game.clinging === 'left' ? 14 : game.clinging === 'right' ? -14 : 0) - petX) * 0.16;
        petY += (py + 18 - petY) * 0.14;
        const petScale = ((me?.rig.pixelHeight ?? 24) * CHAR_SCALE * 0.42 / pet.rig.pixelHeight) * Math.max(0.8, Math.min(1.3, pet.size));
        drawRig(ctx, pet.rig, pet.palette, 'idle', clock * 1000, petX, petY, game.facing, petScale);
      }
      // The climber.
      if (me) drawRig(ctx, me.rig, me.palette, game.clinging ? 'idle' : 'walk', clock * 1000, px, py, game.facing, CHAR_SCALE);
      else { ctx.fillStyle = '#e9d5ff'; ctx.fillRect(px - 7, py - 38, 14, 38); }

      // Height marks on the wall every 10 metres.
      const bestLineY = sy(game.bestY);
      ctx.fillStyle = 'rgba(251,191,36,0.5)'; ctx.fillRect(left - 30, bestLineY, 30, 2);

      // Loading bar.
      const barW = Math.min(width - 48, 360);
      const bx = (width - barW) / 2;
      const by = height_ - 78;
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(bx, by, barW, 6);
      ctx.fillStyle = isReady ? '#34d399' : '#f0abfc';
      if (p === null || p === undefined) { const seg = barW * 0.28; ctx.fillRect(bx + ((clock * 0.45) % 1) * (barW - seg), by, seg, 6); }
      else ctx.fillRect(bx, by, barW * Math.max(0, Math.min(1, p)), 6);
    };

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = time; return; }
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      clock += dt;
      if (Math.floor(clock * 2) % 8 === 0) resize();
      if (fallTimer > 0) {
        fallTimer -= dt;
        if (fallTimer <= 0) { game = createClimb(newClimbRun(), game.gap); setFallen(null); petX = game.x; petY = height_ * 0.62; }
      } else {
        const events = advanceClimb(game, dt, leapQueued.current);
        leapQueued.current = false;
        const metres = Math.floor(Math.max(0, -game.bestY) / 10);
        if (metres !== shownHeight) {
          shownHeight = metres;
          setHeight(metres);
          if (metres > runBest) { runBest = metres; setBest(metres); writeBest(metres); }
        }
        if (events.fell) { fallTimer = 1.1; setFallen(metres); }
      }
      draw();
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black" data-testid="climb-loader">
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" onPointerDown={() => { leapQueued.current = true; }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 px-4 pt-[max(1.5rem,var(--safe-top))] text-center">
        <h2 className="font-mono text-lg font-black uppercase tracking-[0.2em] text-white drop-shadow">{title}</h2>
        <p className="font-mono text-xs text-fuchsia-100" role="status" aria-live="polite" data-testid="climb-status">{status}</p>
        <p className="font-mono text-3xl font-black text-amber-100 drop-shadow" data-testid="climb-height">{t('climb.height', { n: String(height) })}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">{fallen !== null ? t('climb.fell', { n: String(fallen) }) : t('climb.best', { n: String(best) })}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/45">{t('climb.hint')}</p>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3 px-4 pb-[max(0.25rem,var(--safe-bottom))]">
        {ready ? <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-200" data-testid="climb-loaded">{t('climb.loaded', { n: String(height) })}</span> : null}
        {ready && onEnter ? <button type="button" onClick={onEnter} className="border border-emerald-300/60 bg-emerald-400/20 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-50" data-testid="button-climb-enter">{t('walk.enter')}</button> : null}
        {onCancel ? <button type="button" onClick={onCancel} className="border border-white/30 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-white" data-testid="button-climb-cancel">{cancelLabel ?? t('walk.back')}</button> : null}
      </div>
    </div>
  );
}
