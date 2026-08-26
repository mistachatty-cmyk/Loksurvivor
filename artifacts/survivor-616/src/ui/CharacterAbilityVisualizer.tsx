import { motion } from 'framer-motion';
import { Crosshair, Footprints, Sparkles, Target } from 'lucide-react';
import type { CharacterDef } from '@/game/types';
import { RigPortrait } from './RigPortrait';

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
        <DemoBox title={character.weapon.name} icon={<Target className="h-3.5 w-3.5" />} color={accent} description={character.weapon.description}>
          <motion.div
            animate={{ x: [34, 86, 122, 86, 34], opacity: [0.2, 1, 0.9, 1, 0.2] }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-8 left-0 h-1.5 w-24 rounded-full"
            style={{ backgroundColor: accent, boxShadow: `0 0 18px ${accent}` }}
          />
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ x: [164, 138, 164], scale: [0.7, 1.15, 0.7], opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.1, delay: i * 0.22, repeat: Infinity }}
              className="absolute bottom-[42px] h-5 w-5 border-2"
              style={{ borderColor: accent, backgroundColor: `${accent}22` }}
            />
          ))}
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