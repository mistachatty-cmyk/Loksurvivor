import { motion } from 'framer-motion';
import { Crosshair, Footprints, Sparkles } from 'lucide-react';
import type { CharacterDef, WeaponKind } from '@/game/types';
import { RigPortrait } from './RigPortrait';
import { WeaponIcon } from './WeaponIcon';

interface CharacterAbilityVisualizerProps {
  character: CharacterDef;
}

function DemoBox({ title, icon, color, children, description }: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  description: string;
}) {
  return (
    <div className="border border-border bg-black/35 p-3 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{title}</span>
        <span className="ml-auto text-[9px] uppercase tracking-widest text-muted-foreground">live preview</span>
      </div>
      <div className="relative h-28 overflow-hidden border border-white/10 bg-gradient-to-b from-slate-950 to-black">
        <div className="absolute inset-x-0 bottom-4 border-t border-dashed border-white/10" />
        {children}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/** A star-burst shape used by the punch/melee preview, matching WeaponIcon's impact glyph. */
const STAR_CLIP = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';

/**
 * Per-kind mini-animation for the weapon preview. Mirrors the shape language
 * WeaponIcon.tsx and render/draw.ts already use per WeaponKind, so the field
 * preview actually resembles what the weapon looks like mid-run instead of
 * one generic sliding pill for every kind.
 */
function WeaponPatternDemo({ kind, color, count }: { kind: WeaponKind; color: string; count?: number }) {
  switch (kind) {
    case 'orbit':
    case 'follower': {
      const blades = Math.max(1, Math.min(count ?? (kind === 'orbit' ? 2 : 1), 3));
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: kind === 'follower' ? 2.6 : 1.8, repeat: Infinity, ease: 'linear' }}
            className="absolute h-16 w-16"
          >
            {Array.from({ length: blades }).map((_, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-0 h-3 w-2 -translate-x-1/2 rounded-sm"
                style={{
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                  transform: `translateX(-50%) rotate(${(360 / blades) * i}deg) translateY(0)`,
                  transformOrigin: '50% 32px',
                }}
              />
            ))}
          </motion.div>
        </div>
      );
    }
    case 'projectile':
    case 'homing':
      return (
        <motion.div
          animate={
            kind === 'homing'
              ? { x: [-64, 0, 64], y: [8, -10, 8], rotate: [8, -8, 8], opacity: [0.2, 1, 0.2] }
              : { x: [-64, 64], opacity: [0.2, 1, 0.2] }
          }
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-1.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
      );
    case 'sweep':
      return (
        <motion.div
          animate={{ rotate: [-32, 32, -32] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-3 top-1/2 h-1.5 w-20 origin-left rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
      );
    case 'aura':
    case 'hazard':
      return (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ borderColor: color }}
          animate={{ width: [22, 64, 22], height: [22, 64, 22], opacity: [0.75, 0.15, 0.75] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      );
    case 'laser':
      return (
        <>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <motion.div
              className="h-0.5 w-full"
              style={{ background: color }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          </div>
          <motion.div
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: color, boxShadow: `0 0 14px ${color}` }}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        </>
      );
    case 'nova':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ borderColor: color }}
              animate={{ width: [8, 76], height: [8, 76], opacity: [0.85, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
            />
          ))}
        </>
      );
    case 'wave':
      return (
        <>
          {[0, 1].map((i) => (
            <motion.div
              key={i}
              className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ borderColor: color }}
              animate={{ x: [-8, 92], width: [10, 52], height: [10, 52], opacity: [0.9, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
            />
          ))}
        </>
      );
    case 'punch':
    case 'melee':
      return (
        <motion.div
          className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2"
          style={{ background: color, clipPath: STAR_CLIP }}
          animate={{ scale: [0, 1.1, 0.9], opacity: [0, 1, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' }}
        />
      );
    case 'teleport':
      return (
        <motion.div
          className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed"
          style={{ borderColor: color }}
          animate={{ left: ['33%', '33%', '33%', '66%', '66%', '66%'], opacity: [1, 1, 0, 0, 1, 1] }}
          transition={{ duration: 2, repeat: Infinity, times: [0, 0.35, 0.42, 0.48, 0.55, 1] }}
        />
      );
    case 'convert':
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          <motion.div
            className="h-9 w-9 rounded-full border-2"
            style={{ borderColor: color }}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="-ml-4 h-9 w-9 rounded-full border-2"
            style={{ borderColor: color }}
            animate={{ scale: [1.18, 1, 1.18] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      );
    default:
      return (
        <motion.div
          animate={{ x: [-64, 64], opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-1.5 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
      );
  }
}

export function CharacterAbilityVisualizer({ character }: CharacterAbilityVisualizerProps) {
  const accent = character.palette.accent;
  return (
    <section className="mb-5 border border-primary/40 bg-card/70 p-3 sm:p-4" data-testid="character-ability-visualizer">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Field preview</h2>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-primary">{character.name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">walking / attack / special</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[150px_1fr_1fr]">
        <div className="relative flex min-h-[154px] flex-col items-center justify-end overflow-hidden border border-white/10 bg-black/40 pb-2">
          <div className="absolute inset-x-4 bottom-6 border-t border-dashed border-white/10" />
          <motion.div
            animate={{ x: [-5, 5, -5], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10"
          >
            <RigPortrait rig={character.rig} palette={character.palette} anim="walk" size={104} />
          </motion.div>
          <div className="relative z-10 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            <Footprints className="h-3 w-3" /> advancing
          </div>
        </div>
        <DemoBox title={character.weapon.name} icon={<WeaponIcon weaponId={character.weapon.id} kind={character.weapon.kind} color={accent} size={28} label={character.weapon.name} />} color={accent} description={character.weapon.description}>
          <WeaponPatternDemo kind={character.weapon.kind} color={accent} count={character.weapon.count} />
          <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-widest text-white/50">{character.weapon.kind} pattern</div>
        </DemoBox>
        <DemoBox title={character.ultimate.name} icon={<Sparkles className="h-3.5 w-3.5" />} color={character.palette.glow} description={character.ultimate.description}>
          <motion.div
            animate={{ scale: [0.35, 1.25, 1.7], opacity: [0.8, 0.45, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: character.palette.glow, boxShadow: `0 0 24px ${character.palette.glow}` }}
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 border border-dashed"
            style={{ borderColor: character.palette.accentBright }}
          />
          <div className="absolute bottom-3 left-3 text-[9px] uppercase tracking-widest text-white/50">{character.ultimate.durationMs / 1000}s signature window</div>
        </DemoBox>
      </div>
    </section>
  );
}

export default CharacterAbilityVisualizer;
