/**
 * Bestiary. Entries reveal themselves as the player defeats each enemy.
 * Owned by the design pass -- keep the export name and props stable.
 */
import { endgameReached } from '@/game/data/endgameUnlocks';
import { isFeatureAvailable } from '@/game/state/operatorForgeStore';
import { t } from '@/lib/i18n';
import { CustomBestiaryView } from './CustomBestiaryView';
import { ENEMIES } from '@/game/data/enemies';
import { CHARACTERS } from '@/game/data/characters';
import { FACTIONS } from '@/game/data/factions';
import { describeUnlock, useMeta } from '@/game/state/metaStore';
import { QuirkChart } from './QuirkChart';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { WeaponIcon } from './WeaponIcon';
import { motion } from 'framer-motion';
import { Skull, Ghost, LockKeyhole, Sparkles, Users, X, Info, ShieldAlert, Zap, Search, Volume2, Target } from 'lucide-react';
import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';
import { useState, useEffect, useMemo } from 'react';

export interface BestiaryPanelProps {
  onBack: () => void;
}

function EnemyPreview({ enemy }: { enemy: (typeof ENEMIES)[number] }) {
  const activeAnim = enemy.behavior === 'shockwave' || enemy.behavior === 'spitter' || enemy.behavior === 'charger' ? 'attack' : 'walk';
  return (
    <div className="relative grid h-28 w-24 shrink-0 place-items-center overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.08),transparent_62%)]" role="img" aria-label={`Animated pixel model of ${enemy.name}`}>
      <RigPortrait rig={enemy.rig} palette={enemy.palette} anim={activeAnim} size={94} />
      <span className="absolute inset-x-1 bottom-1 text-center font-mono text-[8px] uppercase tracking-widest text-white/35">live specimen</span>
    </div>
  );
}

const BEHAVIOR_GUIDES: Record<
  string,
  { desc: string; tip: string; threatTier: string; weakVs: string; soundSignature: string; dropProfile: string }
> = {
  'strafe-duelist': {
    desc: 'Circle-strafes at mid range, telegraphs, then lunges through you in a slash arc.',
    tip: 'Dash across its lunge line as the telegraph ends; it is open after every lunge.',
    threatTier: 'Skirmisher', weakVs: 'Area damage while it circles', soundSignature: 'Quick shoe squeaks', dropProfile: '',
  },
  pouncer: {
    desc: 'Marks the spot where you stand, leaps there and lands in a shockwave ring.',
    tip: 'Leave the marked ring before the landing; strike it after it lands.',
    threatTier: 'Ambusher', weakVs: 'Moving targets and ranged hits', soundSignature: 'Soft crouch, hard landing', dropProfile: '',
  },
  'beam-wheel': {
    desc: 'Plants itself and spins a wheel of short beams around it.',
    tip: 'Stay outside its beam range or circle against the spin direction.',
    threatTier: 'Zone Anchor', weakVs: 'Burst damage while it is walking in', soundSignature: 'Rising wheel hum', dropProfile: '',
  },
  'mine-stitcher': {
    desc: 'Zigzags toward you, dropping lingering mines along its path.',
    tip: 'Do not retreat over its trail. Kill it early before the floor fills.',
    threatTier: 'Area Denial', weakVs: 'Piercing shots down its zigzag', soundSignature: 'Tick, tick, snap', dropProfile: '',
  },
  'fan-sampler': {
    desc: 'Kites at range and fires a wide fan of projectiles.',
    tip: 'Step between shots in the fan, or close in; it backs away slowly.',
    threatTier: 'Ranged Support', weakVs: 'Dashes and cover', soundSignature: 'Fan of paper snaps', dropProfile: '',
  },
  rewinder: {
    desc: 'Saves its position, then snaps back to it, bursting at both ends.',
    tip: 'Do not stand on its saved spot, and do not chase it when it vanishes.',
    threatTier: 'Disruptor', weakVs: 'Delayed area attacks', soundSignature: 'Tape rewinding', dropProfile: '',
  },
  charger: {
    desc: 'Rapid linear acceleration bull-rush when target enters line-of-sight.',
    tip: 'Sidestep perpendicular as charge begins; punish sluggish turn recovery.',
    threatTier: 'Heavy Striker',
    weakVs: 'Cryo-Byte Freeze & Kinetic Stun',
    soundSignature: '120Hz Pneumatic Servo Whine',
    dropProfile: 'High Density Scrap & Kinetic Shards',
  },
  spitter: {
    desc: 'Maintains standoff perimeter while launching concentrated ballistic volleys.',
    tip: 'Close distance using dash-cancels or deploy forward shield covers.',
    threatTier: 'Artillery Gunner',
    weakVs: 'Volt Discharge & Swift Melee',
    soundSignature: 'High-Pitch Compression Pop',
    dropProfile: 'Chemical Acid Vials & Corrupted Logic Chips',
  },
  shockwave: {
    desc: 'Discharges expanding concussive kinetic pulses across a wide blast radius.',
    tip: 'Time invulnerability dash through pulse wave or maintain extreme standoff range.',
    threatTier: 'Area Denial Unit',
    weakVs: 'High-Caliber Penetrator',
    soundSignature: 'Sub-Bass 40Hz Seismic Rumble',
    dropProfile: 'Piezoelectric Cores & Kinetic Powder',
  },
  swarmer: {
    desc: 'Hunts in dense cohorts with erratic zig-zag paths to overwhelm survivor flanks.',
    tip: 'Deploy continuous beam sweeps, persistent hazard pools, or radial shotguns.',
    threatTier: 'Pack Swarmer',
    weakVs: 'Pyro-Bit Fire & Area-of-Effect',
    soundSignature: 'Chattering Chitinous Drone',
    dropProfile: 'Micro-Nanite Cells & Common Bio-Gems',
  },
  exploder: {
    desc: 'Unstable internal reactor initiates terminal self-destruction upon close proximity.',
    tip: 'Engage strictly from max range; clear blast perimeter before detonation.',
    threatTier: 'Volatile Demolition',
    weakVs: 'Long-Range Sniping',
    soundSignature: 'Accelerating Tachyon Siren',
    dropProfile: 'Volatile Fusion Fuel & Explosive Residue',
  },
  'vortex-crusher': {
    desc: 'Generates gravitational suction singularity pulling operative toward crushing radius.',
    tip: 'Sprint outwards using speed boots or dash skill immediately when accretion begins.',
    threatTier: 'Gravimetric Apex',
    weakVs: 'Overclocked Lasers & Phase Shifts',
    soundSignature: 'Infrasonic Singularity Hum',
    dropProfile: 'Graviton Condensers & Rare Void Cores',
  },
  'nanite-swarm': {
    desc: 'Self-replicating cloud of micro-drones that phases through obstacles and drains health.',
    tip: 'Use continuous AoE fire or electric arcs that jump across dense clusters.',
    threatTier: 'Dispersal Swarm',
    weakVs: 'Volt EMP & Flamethrowers',
    soundSignature: 'High-Frequency Static Buzz',
    dropProfile: 'Refined Nanite Paste & Silicon Dust',
  },
  'arc-conductor': {
    desc: 'Chains lethal electrical current across all nearby allies and targets.',
    tip: 'Isolate conductor from other enemies to suppress lethal chain-lightning bridges.',
    threatTier: 'Chain Specialist',
    weakVs: 'Ground Shock & Cryo Glassing',
    soundSignature: 'Ionized Ozone Crackle',
    dropProfile: 'Copper Field Coils & Overcharged Batteries',
  },
  teleporter: {
    desc: 'Blinks instantly into blindspots or perimeter flanks when aimed at.',
    tip: 'Anticipate reappearance delay; drop proximity mines or radial pulses at feet.',
    threatTier: 'Phase Infiltrator',
    weakVs: 'Homing Micro-Missiles',
    soundSignature: 'Phase-Displacement Pop',
    dropProfile: 'Warp Drives & Entangled Photons',
  },
  wraith: {
    desc: 'Invisible while stalking; phases into reality right before delivering lethal scythe strike.',
    tip: 'Listen for audio distortion and dash when the translucent shimmer appears.',
    threatTier: 'Phantom Assassin',
    weakVs: 'Thermal Sensor Scans & Wide Flame Sprays',
    soundSignature: 'Ethereal Spectral Murmur',
    dropProfile: 'Dark Matter Essence & Ghost Shards',
  },
  ringer: {
    desc: 'Orbits operative at precise fixed radius, waiting for defensive lapses.',
    tip: 'Break orbit geometry by running perpendicular or setting directional ambush.',
    threatTier: 'Orbital Skirmisher',
    weakVs: 'Long-Reach Sweepers',
    soundSignature: 'Doppler Ring Whistle',
    dropProfile: 'Gyro Stabilizers & Precision Bearings',
  },
  sentry: {
    desc: 'Fixed or slow turret anchor establishing lethal interlocking fields of fire.',
    tip: 'Use environmental cover and high-impact burst damage to decommission quickly.',
    threatTier: 'Bastion Fortification',
    weakVs: 'Armor-Piercing Slugs',
    soundSignature: 'Hydraulic Locking Clank',
    dropProfile: 'Reinforced Armor Plates & Heavy Shells',
  },
  flanker: {
    desc: 'Circumvents frontal defenses to target the operative from rear and side arcs.',
    tip: 'Maintain back to barriers or periodically reverse sweep to clear trail.',
    threatTier: 'Tactical Flanker',
    weakVs: 'Rear-Firing Drones & Radial Blasts',
    soundSignature: 'Muffled Tread Whine',
    dropProfile: 'Agility Actuators & Recon Microchips',
  },
  pincer: {
    desc: 'Coordinates dual-pronged pincers with sister units to box in target trajectory.',
    tip: 'Break through the weaker flank before both prongs close the encirclement.',
    threatTier: 'Encirclement Unit',
    weakVs: 'Cryo Freeze to disrupt pincer synchronization',
    soundSignature: 'Dual-Tone Mechanical Chime',
    dropProfile: 'Hydraulic Pincer Blades & Alloy Joints',
  },
  prism: {
    desc: 'Refracts colored beams of varying elemental states: pull, slow, and elemental damage.',
    tip: 'Identify beam color frequency: red is burn, blue is cryo, violet is gravity drag.',
    threatTier: 'Prismatic Controller',
    weakVs: 'Kinetic Disruptors',
    soundSignature: 'Resonant Crystal Oscillation',
    dropProfile: 'Optical Prisms & Refractive Crystals',
  },
  beacon: {
    desc: 'Projects roaming tracking circles that call down artillery strikes if stepped into.',
    tip: 'Stay outside tracking perimeter rings and eliminate beacon commander swiftly.',
    threatTier: 'Targeting Coordinator',
    weakVs: 'High-Speed Interceptors',
    soundSignature: 'Sonar Ping Echo',
    dropProfile: 'Targeting HUDs & Laser Modules',
  },
  commander: {
    desc: 'Directs frontline units with morale boosts and defensive formation buffs.',
    tip: 'Priority focus fire: eliminating commander immediately weakens surrounding cohort.',
    threatTier: 'Squad Officer',
    weakVs: 'High-Burst Assassination Weapons',
    soundSignature: 'Encrypted Radio Broadcast',
    dropProfile: 'Command Encryption Keys & Gold Credits',
  },
};

function EnemyIntelModal({
  enemy,
  kills,
  onClose,
}: {
  enemy: (typeof ENEMIES)[number];
  kills: number;
  onClose: () => void;
}) {
  const known = kills > 0;
  const faction = FACTIONS.find((f) => f.roster.includes(enemy.id));
  const [anim, setAnim] = useState<'idle' | 'walk' | 'attack'>('walk');

  const guide = BEHAVIOR_GUIDES[enemy.behavior] ?? {
    desc: 'Standard offensive threat doctrine. Advances toward nearest operational survivor.',
    tip: 'Maintain perimeter spacing and eliminate with high-damage sustained fire.',
    threatTier: enemy.hp > 300 ? 'Apex Vanguard' : enemy.hp > 100 ? 'Elite Combatant' : 'Standard Recon',
    weakVs: 'Focused Fire',
  };

  const dangerRating =
    enemy.hp >= 500
      ? 'CRITICAL / APEX BOSS'
      : enemy.hp >= 150
      ? 'HIGH THREAT / ELITE'
      : enemy.hp >= 60
      ? 'MODERATE THREAT'
      : 'STANDARD OPERATIVE';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden border border-white/20 bg-[#0d0e16] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[.02] p-4">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center border border-rose-400/40 bg-rose-500/10 text-rose-300"
              style={{ borderColor: faction?.accent ? `${faction.accent}66` : undefined }}
            >
              <ShieldAlert className="h-4 w-4" style={{ color: faction?.accent }} />
            </span>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-white/40">
                Threat Dossier · {faction ? faction.name : 'Independent Entity'}
              </p>
              <h3 className="font-display text-lg font-black uppercase text-white">
                {known ? enemy.name : 'Unidentified Specimen'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center border border-white/20 text-white/70 hover:border-white/50 hover:text-white"
            aria-label="Close dossier"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col sm:flex-row items-center gap-4 border border-white/10 bg-black/40 p-3.5">
            {/* Live Rig Model with Animation Control */}
            <div className="flex flex-col items-center">
              <div className="relative grid h-28 w-28 place-items-center overflow-hidden border border-white/15 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.1),transparent_65%)]">
                {known ? (
                  <RigPortrait rig={enemy.rig} palette={enemy.palette} anim={anim} size={90} />
                ) : (
                  <Ghost className="h-10 w-10 text-white/25" />
                )}
              </div>
              {known && (
                <div className="mt-1.5 flex gap-1 font-mono text-[7px] uppercase">
                  {(['walk', 'attack', 'idle'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAnim(a)}
                      className={`border px-1.5 py-0.5 font-bold transition-colors ${
                        anim === a
                          ? 'border-primary bg-primary text-black'
                          : 'border-white/20 bg-black/50 text-white/60 hover:text-white'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 font-mono text-[8px] uppercase">
                <span className="border border-white/20 px-2 py-0.5 text-white/80">
                  Family: {known ? enemy.family : 'Unknown'}
                </span>
                <span className="border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-amber-200">
                  {guide.threatTier}
                </span>
              </div>

              <p className="font-display text-base font-black uppercase text-white pt-0.5 truncate">
                {known ? enemy.name : 'Unknown Threat'}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 font-mono text-[8.5px] text-white/50">
                <span className="flex items-center gap-1">
                  <Skull className="h-3 w-3 text-rose-400" />
                  Kills: <strong className="text-white">{kills}x</strong>
                </span>
                <span className="font-bold text-amber-300">
                  Tier: {dangerRating}
                </span>
              </div>
            </div>
          </div>

          {/* Combat Statistics Grid */}
          <div className="grid grid-cols-4 gap-2 font-mono text-[9px] uppercase border border-white/10 bg-black/30 p-2.5">
            <div className="text-center">
              <span className="text-white/40 block text-[8px]">Health</span>
              <span className="text-sm font-bold text-rose-300">{known ? enemy.hp : '???'}</span>
            </div>
            <div className="text-center">
              <span className="text-white/40 block text-[8px]">Damage</span>
              <span className="text-sm font-bold text-amber-300">{known ? enemy.damage : '???'}</span>
            </div>
            <div className="text-center">
              <span className="text-white/40 block text-[8px]">Speed</span>
              <span className="text-sm font-bold text-sky-300">{known ? enemy.speed : '???'}</span>
            </div>
            <div className="text-center">
              <span className="text-white/40 block text-[8px]">XP Yield</span>
              <span className="text-sm font-bold text-emerald-300">{known ? enemy.xp : '???'}</span>
            </div>
          </div>

          {/* Tactical Behavior & Survival Tips */}
          <div className="border border-white/10 bg-white/[.02] p-3 text-xs leading-relaxed space-y-2">
            <div>
              <p className="font-mono text-[8px] font-black uppercase tracking-widest text-primary mb-0.5">
                Attack Doctrine & Behavior ({known ? enemy.behavior : 'Classified'}):
              </p>
              <p className="text-white/80 text-[11px]">{guide.desc}</p>
            </div>
            <div className="border-t border-white/10 pt-2">
              <p className="font-mono text-[8px] font-black uppercase tracking-widest text-amber-300 mb-0.5">
                Survival Tactical Countermeasure:
              </p>
              <p className="text-white/70 text-[11px]">{guide.tip}</p>
            </div>
            <div className="border-t border-white/10 pt-2 flex items-center justify-between font-mono text-[8.5px] uppercase">
              <span className="text-white/40">Tactical Weakness:</span>
              <strong className="text-emerald-300">{guide.weakVs}</strong>
            </div>

            {/* Acoustic Audio Signature */}
            {guide.soundSignature && (
              <div className="border-t border-white/10 pt-2 flex items-center justify-between font-mono text-[8.5px] uppercase">
                <span className="text-white/40 flex items-center gap-1.5">
                  <Volume2 className="h-3 w-3 text-sky-400" /> Acoustic Profile:
                </span>
                <span className="text-sky-200">{guide.soundSignature}</span>
              </div>
            )}

            {/* Salvage Drop Profile */}
            {enemy.drops?.length ? (
              <div className="border-t border-white/10 pt-2 font-mono text-[8.5px] uppercase">
                <span className="text-white/40 flex items-center gap-1.5 mb-1">
                  <Target className="h-3 w-3 text-amber-400" /> Confirmed drops:
                </span>
                <ul className="text-amber-200 space-y-0.5">
                  {enemy.drops.map((drop, index) => (
                    <li key={`${drop.kind}-${index}`}>{drop.kind.replace(/-/g, ' ')} · {Math.round(drop.chance * 100)}%</li>
                  ))}
                </ul>
              </div>
            ) : guide.dropProfile && (
              <div className="border-t border-white/10 pt-2 flex items-center justify-between font-mono text-[8.5px] uppercase">
                <span className="text-white/40 flex items-center gap-1.5">
                  <Target className="h-3 w-3 text-amber-400" /> Field Salvage:
                </span>
                <span className="text-amber-200">{guide.dropProfile}</span>
              </div>
            )}
          </div>

          {/* Lore Briefing */}
          <div className="border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-white/65">
            <p className="font-mono text-[8px] font-bold uppercase tracking-widest text-white/40 mb-1">
              Field Intelligence Lore:
            </p>
            {known ? (
              <p className="italic">"{enemy.lore}"</p>
            ) : (
              <p className="text-white/40 italic">
                No verified operational sighting recorded. Defeat this enemy in district runs or sector encounters to decrypt intelligence.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BestiaryPanel({ onBack }: BestiaryPanelProps) {
  const { meta, unlockedCharacters } = useMeta();
  const isListView = meta.uiDensity === 'list';
  const [view, setView] = useState<'threats' | 'factions' | 'effects' | 'custom'>('threats');
  const [selectedEnemy, setSelectedEnemy] = useState<(typeof ENEMIES)[number] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [threatFilter, setThreatFilter] = useState<'all' | 'discovered' | 'apex'>('all');

  // Enemies excluded from the ratio (e.g. Choir Wraith's HP is intentionally
  // beyond a run's reach) so 100% stays a reachable goal.
  const customBestiaryOpen = meta.devModeAllUnlocks || (endgameReached(meta) && isFeatureAvailable('forge'));
  const catalogueEnemies = ENEMIES.filter((e) => !e.excludeFromBestiary);
  const discovered = catalogueEnemies.filter((e) => (meta.bestiary[e.id] ?? 0) > 0).length;
  const unlockedIds = new Set(unlockedCharacters.map((character) => character.id));
  const discoveredFactionCount = FACTIONS.filter((faction) =>
    faction.roster.some((enemyId) => (meta.bestiary[enemyId] ?? 0) > 0),
  ).length;

  const filteredEnemies = useMemo(() => {
    return ENEMIES.filter((enemy) => {
      const kills = meta.bestiary[enemy.id] ?? 0;
      if (threatFilter === 'discovered' && kills === 0) return false;
      if (threatFilter === 'apex' && enemy.hp < 150) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        enemy.name.toLowerCase().includes(q) ||
        enemy.family.toLowerCase().includes(q) ||
        enemy.behavior.toLowerCase().includes(q) ||
        enemy.lore.toLowerCase().includes(q)
      );
    });
  }, [meta.bestiary, threatFilter, searchQuery]);

  const filteredFactions = useMemo(() => {
    if (!searchQuery.trim()) return FACTIONS;
    const q = searchQuery.toLowerCase().trim();
    return FACTIONS.filter((faction) => {
      if (faction.name.toLowerCase().includes(q) || faction.description.toLowerCase().includes(q)) return true;
      return faction.roster.some((enemyId) => {
        const e = ENEMIES.find((enemy) => enemy.id === enemyId);
        return e && (e.name.toLowerCase().includes(q) || e.family.toLowerCase().includes(q));
      });
    });
  }, [searchQuery]);

  return (
    <ScreenLayout 
      title="Bestiary" 
      subtitle="Known Threats"
      onBack={onBack}
      action={
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Catalogued</p>
          <p className="text-2xl font-black text-white">{discovered} <span className="text-muted-foreground text-sm">/ {catalogueEnemies.length}</span></p>
        </div>
      }
    >
      <section className="mb-10" data-testid="section-character-visualizers">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary font-bold">The living archive</p>
            <h2 className="text-2xl font-black text-white">Character visualizers</h2>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{unlockedCharacters.length} / {CHARACTERS.length} available</p>
        </div>
        <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
          {CHARACTERS.map((character, i) => {
            const unlocked = unlockedIds.has(character.id);
            const characterPalette = resolveCharacterCosmeticPalette(
              character,
              meta.characterSkinByCharacterId[character.id],
              meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId),
              meta.worldPaletteBlendEnabled,
            );
            return (
              <motion.article
                key={character.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative overflow-hidden border ${unlocked ? 'border-primary/40 bg-card' : 'border-border/50 bg-card/30'}`}
                data-testid={`card-character-visualizer-${character.id}`}
              >
                <div className={`relative h-44 flex items-end justify-center border-b border-border ${unlocked ? 'bg-gradient-to-b from-primary/15 to-black' : 'bg-black/50'}`}>
                  {unlocked ? (
                    <RigPortrait rig={character.rig} palette={characterPalette} anim="idle" size={164} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground/50">
                      <LockKeyhole className="h-8 w-8" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Visualizer locked</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className={`text-xl font-black uppercase tracking-tight ${unlocked ? 'text-white' : 'text-muted-foreground'}`}>
                          {unlocked ? character.name : '???'}
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {unlocked ? character.handle : describeUnlock(character.unlock)}
                        </p>
                      </div>
                      {unlocked && <span className="border border-primary/50 bg-primary/15 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-primary">Active</span>}
                    </div>
                  </div>
                </div>
                {unlocked ? (
                  <div className="space-y-4 p-4">
                    <p className="text-xs italic leading-relaxed text-muted-foreground">"{character.bio}"</p>
                    <div className="grid gap-3 border-t border-border/60 pt-3">
                      <div className="flex gap-3">
                        <WeaponIcon weaponId={character.weapon.id} kind={character.weapon.kind} color={character.weapon.color ?? characterPalette.accent} size={32} label={character.weapon.name} className="shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white">{character.weapon.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{character.weapon.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white">{character.ultimate.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{character.ultimate.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-xs italic text-muted-foreground/60">
                    Rescue or clear the required district to bring this survivor into focus.
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3" data-testid="bestiary-view-nav">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-xl font-black uppercase tracking-tight text-white">
            {view === 'threats' ? 'Known threats' : view === 'effects' ? 'Random effects' : view === 'factions' ? 'Factions' : t('bestiary.custom.tab')}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('threats')}
            className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              view === 'threats'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
            }`}
            data-testid="button-bestiary-view-threats"
          >
            <Skull className="h-3.5 w-3.5" />
            Threats
            <span className="font-mono text-[10px] opacity-75">{discovered} / {catalogueEnemies.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('factions')}
            className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              view === 'factions'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
            }`}
            data-testid="button-bestiary-view-factions"
          >
            <Users className="h-3.5 w-3.5" />
            Factions
            <span className="font-mono text-[10px] opacity-75">{discoveredFactionCount} / {FACTIONS.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setView('effects')}
            className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              view === 'effects'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
            }`}
            data-testid="button-bestiary-view-effects"
          >
            <Zap className="h-3.5 w-3.5" />
            Effects
          </button>
          {customBestiaryOpen ? (
            <button
              type="button"
              onClick={() => setView('custom')}
              className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                view === 'custom'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-white'
              }`}
              data-testid="button-bestiary-view-custom"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('bestiary.custom.tab')}
            </button>
          ) : null}
        </div>
      </div>

      {view === 'custom' && customBestiaryOpen ? <CustomBestiaryView kills={meta.bestiary} /> : null}

      {/* Search and Filters Bar */}
      <div hidden={view === 'custom'} className="mb-5 flex flex-wrap items-center gap-2.5 border-b border-border/60 pb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={view === 'threats' ? 'Filter threats by name, family, behavior...' : 'Search factions & operative dossiers...'}
            className="w-full bg-black/50 border border-border pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary font-mono rounded"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white text-xs font-mono px-1"
            >
              ✕
            </button>
          )}
        </div>

        {view === 'threats' && (
          <div className="flex items-center gap-1 font-mono text-[9px] uppercase">
            <button
              type="button"
              onClick={() => setThreatFilter('all')}
              className={`border px-2.5 py-1.5 font-bold transition-colors ${
                threatFilter === 'all'
                  ? 'border-primary bg-primary text-black'
                  : 'border-border bg-card text-muted-foreground hover:text-white'
              }`}
            >
              All ({ENEMIES.length})
            </button>
            <button
              type="button"
              onClick={() => setThreatFilter('discovered')}
              className={`border px-2.5 py-1.5 font-bold transition-colors ${
                threatFilter === 'discovered'
                  ? 'border-emerald-400 bg-emerald-400 text-black'
                  : 'border-border bg-card text-muted-foreground hover:text-white'
              }`}
            >
              Discovered ({discovered})
            </button>
            <button
              type="button"
              onClick={() => setThreatFilter('apex')}
              className={`border px-2.5 py-1.5 font-bold transition-colors ${
                threatFilter === 'apex'
                  ? 'border-amber-400 bg-amber-400 text-black'
                  : 'border-border bg-card text-muted-foreground hover:text-white'
              }`}
            >
              Apex / Elites
            </button>
          </div>
        )}
      </div>

      {view === 'custom' ? null : view === 'effects' ? (
        <QuirkChart mapsCleared={meta.clearedAreaIds.length} />
      ) : view === 'factions' ? (
        filteredFactions.length === 0 ? (
          <div className="border border-border/60 bg-card/40 p-8 text-center font-mono">
            <p className="text-sm uppercase tracking-wider text-muted-foreground">No factions match current search criteria</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-3 border border-primary/50 bg-primary/10 px-3 py-1 text-xs uppercase font-bold text-primary hover:bg-primary/20"
            >
              Clear Search
            </button>
          </div>
        ) : (
        <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'sm:grid-cols-2'}`} data-testid="section-bestiary-factions">
          {filteredFactions.map((faction) => {
            const roster = faction.roster
              .map((enemyId) => ENEMIES.find((enemy) => enemy.id === enemyId))
              .filter((enemy): enemy is (typeof ENEMIES)[number] => Boolean(enemy));
            const discoveredCount = roster.filter((enemy) => (meta.bestiary[enemy.id] ?? 0) > 0).length;
            return (
              <article
                key={faction.id}
                className="border border-border bg-card"
                data-testid={`card-faction-${faction.id}`}
              >
                <div className="border-l-4 p-4" style={{ borderLeftColor: faction.accent }}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">{faction.name}</h3>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {discoveredCount} / {roster.length}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{faction.description}</p>
                  <p className="mt-2 text-[8.5px] font-mono uppercase tracking-wider text-primary/80 flex items-center gap-1.5">
                    <Info className="h-3 w-3" /> Click any operative to decrypt intelligence dossier
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/60 p-4 sm:grid-cols-4">
                  {roster.map((enemy) => {
                    const known = (meta.bestiary[enemy.id] ?? 0) > 0;
                    return (
                      <button
                        type="button"
                        key={enemy.id}
                        onClick={() => setSelectedEnemy(enemy)}
                        className="flex flex-col items-center gap-1.5 text-center group cursor-pointer transition-all hover:-translate-y-0.5 hover:scale-105 active:scale-95 focus:outline-none p-1.5 rounded border border-transparent hover:border-white/20 hover:bg-white/[.04]"
                        data-testid={`faction-roster-${faction.id}-${enemy.id}`}
                        aria-label={`Inspect ${known ? enemy.name : 'Unidentified threat'}`}
                        title={`Click to inspect ${known ? enemy.name : 'Unidentified threat'} dossier`}
                      >
                        <div className="relative grid h-16 w-16 place-items-center overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.08),transparent_62%)] group-hover:border-primary/50 transition-colors">
                          {known ? (
                            <RigPortrait rig={enemy.rig} palette={enemy.palette} anim="idle" size={56} />
                          ) : (
                            <Ghost className="h-6 w-6 text-muted-foreground/30" />
                          )}
                          <span className="pointer-events-none absolute bottom-0 inset-x-0 bg-black/75 py-0.2 text-[6.5px] font-mono uppercase tracking-wider text-white/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            Inspect
                          </span>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${known ? 'text-white group-hover:text-primary' : 'text-muted-foreground/50'}`}>
                          {known ? enemy.name : 'Unidentified'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
        )
      ) : filteredEnemies.length === 0 ? (
        <div className="border border-border/60 bg-card/40 p-8 text-center font-mono">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">No threats match current filter criteria</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setThreatFilter('all');
            }}
            className="mt-3 border border-primary/50 bg-primary/10 px-3 py-1 text-xs uppercase font-bold text-primary hover:bg-primary/20"
          >
            Clear Filters
          </button>
        </div>
      ) : (
      <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
        {filteredEnemies.map((enemy, i) => {
          const kills = meta.bestiary[enemy.id] ?? 0;
          const known = kills > 0;
          
          return (
            <motion.div 
              key={enemy.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedEnemy(enemy)}
              className={`relative border flex flex-col overflow-hidden cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg active:scale-[0.99] ${
                known ? 'border-border bg-card' : 'border-border/50 bg-card/30'
              }`}
              data-testid={`card-enemy-${enemy.id}`}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`text-xl font-black uppercase tracking-tight ${known ? 'text-white' : 'text-muted-foreground'}`}>
                      {known ? enemy.name : 'Unidentified'}
                    </h3>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${known ? 'text-primary' : 'text-muted-foreground/50'}`}>
                      {known ? enemy.family : 'No confirmed sighting'}
                    </p>
                  </div>
                  {known ? (
                    <div className="flex items-center gap-1.5 bg-black border border-border px-2 py-1">
                      <Skull className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-white font-bold">{kills}x</span>
                    </div>
                  ) : (
                    <Ghost className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>

                {known ? (
                  <>
                    <div className="mb-6 flex flex-1 items-start gap-4">
                      <EnemyPreview enemy={enemy} />
                      <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{enemy.lore}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">HP</span>
                        <span className="text-sm text-white font-mono">{enemy.hp}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">DMG</span>
                        <span className="text-sm text-white font-mono">{enemy.damage}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">SPD</span>
                        <span className="text-sm text-white font-mono">{enemy.speed}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">XP</span>
                        <span className="text-sm text-primary font-mono">{enemy.xp}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[100px]">
                    <div className="h-px bg-border/50 w-full relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      )}

      {selectedEnemy && (
        <EnemyIntelModal
          enemy={selectedEnemy}
          kills={meta.bestiary[selectedEnemy.id] ?? 0}
          onClose={() => setSelectedEnemy(null)}
        />
      )}
    </ScreenLayout>
  );
}

export default BestiaryPanel;
