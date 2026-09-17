import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Anchor,
  Check,
  Compass,
  Cpu,
  Crosshair,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Layers,
  Lock,
  Magnet,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Swords,
  Unlock,
  Wrench,
  Zap,
} from 'lucide-react';
import { ENEMIES } from '@/game/data/enemies';
import { WEAPONS } from '@/game/data/weapons';
import { PASSIVES } from '@/game/data/passives';
import { useMeta, DEFAULT_THREAT_CALIBRATIONS } from '@/game/state/metaStore';
import type {
  ThreatAngleMode,
  ThreatEventId,
} from '@/game/types';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';

export interface ThreatMatrixScreenProps {
  onBack: () => void;
}

type MainTab = 'enemies' | 'arsenal' | 'calibrations';
type ArsenalFilter = 'all' | 'weapons' | 'passives';

const ENEMY_FACTIONS = [
  { id: 'all', label: 'All Targets' },
  { id: 'bubble', label: 'Bubblewash (Pink/Blue)' },
  { id: 'parasite', label: 'Dust Mites & Swarm' },
  { id: 'digital', label: 'Digital Damned' },
  { id: 'elite', label: 'Elites & Bosses' },
] as const;

const WEAPON_KINDS = [
  { id: 'all', label: 'All Kinds' },
  { id: 'melee', label: 'Melee / Slam' },
  { id: 'projectile', label: 'Projectiles' },
  { id: 'wave', label: 'Waves / Nova' },
  { id: 'orbit', label: 'Orbiters & Auras' },
  { id: 'glitch', label: 'Glitch / Anomaly' },
  { id: 'hazard', label: 'Ground Hazards' },
] as const;

const ANGLE_MODES: Array<{ id: ThreatAngleMode; name: string; desc: string; icon: string }> = [
  { id: 'standard', name: 'Omni 360°', desc: 'Standard perimeter ring surrounding player', icon: '◎' },
  { id: 'pincer', name: 'Pincer Flanks', desc: 'Opposing 180° dual fronts converging together', icon: '↔' },
  { id: 'cardinal', name: 'Cardinal Cross', desc: 'Orthogonal incursion: North, East, South, West', icon: '┼' },
  { id: 'corners', name: 'Corner Quads', desc: 'Diagonal incursion from map boundary corners', icon: '╳' },
  { id: 'spiral', name: 'Vortex Spiral', desc: 'Continuous rotating angular sweep around player', icon: '↻' },
];

const ANOMALY_EVENTS: Array<{ id: ThreatEventId; name: string; tag: string; desc: string; color: string }> = [
  {
    id: 'emp-storm',
    name: 'EMP Storm Discharges',
    tag: 'HAZARD PULSE',
    desc: 'Periodic localized lightning strikes detonate across the arena, shocking and electrocuting clusters.',
    color: '#38bdf8',
  },
  {
    id: 'gravity-anomaly',
    name: 'Gravitational Singularity',
    tag: 'SPATIAL COLLAPSE',
    desc: 'Spontaneous micro-blackholes form near combatants, pulling enemies and crystal shards into dense implosions.',
    color: '#a855f7',
  },
  {
    id: 'glitch-surge',
    name: 'Glitch Clock Overclock',
    tag: 'VELOCITY SURGE',
    desc: 'Matrix static waves periodically sweep the field, granting +50% player critical chance and surging tempo.',
    color: '#ec4899',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare Pulses',
    tag: 'PROJECTILE PURGE',
    desc: 'Blinding thermal surges pulse across the district, vaporizing and incinerating all incoming hostile shots.',
    color: '#f59e0b',
  },
  {
    id: 'blood-overclock',
    name: 'Blood Overclock Drive',
    tag: 'RISK / REWARD',
    desc: 'Hostiles gain +25% speed and damage, but disintegrate into double XP gems and bonus credits.',
    color: '#ef4444',
  },
  {
    id: 'swarm-frenzy',
    name: 'Swarm Frenzy Cycles',
    tag: 'UNPREDICTABLE',
    desc: 'Spawn cadence oscillates between calm lulls and intense high-density blitz waves.',
    color: '#10b981',
  },
];

export function ThreatMatrixScreen({ onBack }: ThreatMatrixScreenProps) {
  const {
    meta,
    unlockThreatMatrixWithKeys,
    toggleEnemyDisabled,
    setAllEnemiesDisabled,
    toggleWeaponDisabled,
    setAllWeaponsDisabled,
    togglePassiveDisabled,
    setAllPassivesDisabled,
    setThreatCalibrations,
    resetThreatCalibrations,
    resetArsenalQuarantine,
    toggleThreatUpgrade,
  } = useMeta();

  const [activeTab, setActiveTab] = useState<MainTab>('enemies');

  // Specimen search & filters
  const [enemySearch, setEnemySearch] = useState('');
  const [selectedFaction, setSelectedFaction] = useState<string>('all');

  // Arsenal search & filters
  const [arsenalFilter, setArsenalFilter] = useState<ArsenalFilter>('all');
  const [weaponKindFilter, setWeaponKindFilter] = useState<string>('all');
  const [arsenalSearch, setArsenalSearch] = useState('');

  const isUnlocked = meta.threatMatrixUnlocked || (meta.vendorPurchases?.['threat-matrix-console'] ?? 0) > 0;

  const disabledEnemyIds = useMemo(() => new Set(meta.disabledEnemyIds ?? []), [meta.disabledEnemyIds]);
  const disabledWeaponIds = useMemo(() => new Set(meta.disabledWeaponIds ?? []), [meta.disabledWeaponIds]);
  const disabledPassiveIds = useMemo(() => new Set(meta.disabledPassiveIds ?? []), [meta.disabledPassiveIds]);
  const calibrations = meta.threatCalibrations ?? DEFAULT_THREAT_CALIBRATIONS;

  /* ------------------------------------------------------------------ */
  /* Filtered Datasets                                                   */
  /* ------------------------------------------------------------------ */

  const filteredEnemies = useMemo(() => {
    return ENEMIES.filter((enemy) => {
      if (enemy.excludeFromBestiary && enemy.id !== 'choir-wraith') return false;

      const matchesSearch =
        enemy.name.toLowerCase().includes(enemySearch.toLowerCase()) ||
        enemy.family.toLowerCase().includes(enemySearch.toLowerCase()) ||
        enemy.id.toLowerCase().includes(enemySearch.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFaction === 'bubble') return enemy.id.startsWith('bubble-');
      if (selectedFaction === 'parasite') {
        return enemy.id.includes('mite') || enemy.id.includes('roller') || enemy.id.includes('tick');
      }
      if (selectedFaction === 'digital') {
        return enemy.id.startsWith('digital-') || enemy.id.startsWith('soul-');
      }
      if (selectedFaction === 'elite') {
        return enemy.family === 'Elite' || enemy.family === 'Boss';
      }

      return true;
    });
  }, [enemySearch, selectedFaction]);

  const filteredWeapons = useMemo(() => {
    return WEAPONS.filter((weapon) => {
      const matchesSearch =
        weapon.name.toLowerCase().includes(arsenalSearch.toLowerCase()) ||
        weapon.description.toLowerCase().includes(arsenalSearch.toLowerCase()) ||
        weapon.kind.toLowerCase().includes(arsenalSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (weaponKindFilter === 'melee') return weapon.kind === 'melee' || weapon.kind === 'punch';
      if (weaponKindFilter === 'projectile') return weapon.kind === 'projectile';
      if (weaponKindFilter === 'wave') return weapon.kind === 'wave' || weapon.kind === 'nova' || weapon.kind === 'sweep';
      if (weaponKindFilter === 'orbit') return weapon.kind === 'orbit' || weapon.kind === 'aura';
      if (weaponKindFilter === 'glitch') return weapon.kind === 'glitch' || weapon.kind === 'dvd-bounce';
      if (weaponKindFilter === 'hazard') return weapon.kind === 'hazard';

      return true;
    });
  }, [arsenalSearch, weaponKindFilter]);

  const filteredPassives = useMemo(() => {
    return PASSIVES.filter((passive) => {
      return (
        passive.name.toLowerCase().includes(arsenalSearch.toLowerCase()) ||
        passive.description.toLowerCase().includes(arsenalSearch.toLowerCase())
      );
    });
  }, [arsenalSearch]);

  const activeEnemiesCount = ENEMIES.length - disabledEnemyIds.size;
  const activeWeaponsCount = WEAPONS.length - disabledWeaponIds.size;
  const activePassivesCount = PASSIVES.length - disabledPassiveIds.size;

  const universalIncursionActive = Boolean(meta.threatUpgrades?.['universal-incursion']);
  const cornerMagnetActive = Boolean(meta.threatUpgrades?.['corner-magnet']);
  const tidalAnchorActive = Boolean(meta.threatUpgrades?.['tidal-anchor']);
  const staticInverterActive = Boolean(meta.threatUpgrades?.['static-inverter']);

  // Handle safe weapon quarantine: at least one weapon must always remain active
  const handleToggleWeapon = (weaponId: string) => {
    if (!disabledWeaponIds.has(weaponId) && activeWeaponsCount <= 1) {
      return; // Cannot quarantine last active weapon
    }
    toggleWeaponDisabled(weaponId);
  };

  const handleQuarantineAllWeaponsSafe = () => {
    // Quarantine all except freestyle-mic so player has a valid loadout pool
    setAllWeaponsDisabled(true);
    if (disabledWeaponIds.has('freestyle-mic')) {
      toggleWeaponDisabled('freestyle-mic');
    }
  };

  const handleToggleEvent = (eventId: ThreatEventId) => {
    const current = calibrations.activeEvents ?? [];
    const activeEvents = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];
    setThreatCalibrations({ activeEvents });
  };

  return (
    <ScreenLayout
      title="Threat Matrix"
      subtitle="Security Override Terminal & Tactical Quarantine Control"
      onBack={onBack}
      action={
        <div className="flex items-center gap-3 text-right">
          <div className="rounded border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-right font-mono">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400 font-bold">
              <KeyRound className="h-3 w-3" /> Loot Keys
            </span>
            <span className="text-xl font-black text-amber-200">{meta.skeletonKeys}</span>
          </div>
          <div className="rounded border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-right font-mono">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
              <Cpu className="h-3 w-3" /> Terminal
            </span>
            <span className="text-sm font-black text-emerald-200">
              {isUnlocked ? 'ONLINE // AUTHORIZED' : 'LOCKED'}
            </span>
          </div>
        </div>
      }
    >
      {!isUnlocked ? (
        <div className="mx-auto my-8 max-w-xl rounded-xl border border-red-500/40 bg-red-950/20 p-8 text-center backdrop-blur shadow-2xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/50 bg-red-900/40 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <Lock className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wider text-red-100">
            Threat Matrix Locked
          </h2>
          <p className="mt-2 text-sm text-red-200/80 leading-relaxed">
            The city defense mainframe requires security override clearance.
            Unlock this terminal using 4 Loot Keys (Skeleton Keys) to customize hostiles, isolate weapons &amp; passives, and dial tactical calibrations.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              disabled={meta.skeletonKeys < 4}
              onClick={unlockThreatMatrixWithKeys}
              className={`flex items-center gap-2 rounded-lg border px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all shadow-lg ${
                meta.skeletonKeys >= 4
                  ? 'border-amber-400 bg-amber-500 text-black hover:bg-amber-400 hover:shadow-amber-500/30'
                  : 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              Unlock Threat Matrix (Cost: 4 Loot Keys)
            </button>
            {meta.skeletonKeys < 4 && (
              <p className="text-xs font-mono text-amber-400/80">
                You have {meta.skeletonKeys} / 4 Loot Keys. Break world crates or complete contracts to find more!
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('enemies')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'enemies'
                    ? 'border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Hostile Specimens</span>
                <span className="rounded bg-cyan-900/60 px-1.5 py-0.2 text-[10px] text-cyan-300">
                  {activeEnemiesCount}/{ENEMIES.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('arsenal')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'arsenal'
                    ? 'border border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Swords className="h-3.5 w-3.5" />
                <span>Arsenal Quarantine</span>
                <span className="rounded bg-amber-900/60 px-1.5 py-0.2 text-[10px] text-amber-300">
                  {activeWeaponsCount + activePassivesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('calibrations')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'calibrations'
                    ? 'border border-purple-400/50 bg-purple-500/20 text-purple-200 shadow-sm'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Threat Calibrations</span>
                <span className="rounded bg-purple-900/60 px-1.5 py-0.2 text-[10px] text-purple-300">
                  {calibrations.hpMult}x HP · {calibrations.activeEvents?.length ?? 0} Events
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-white/50">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>OVERRIDE TERMINAL V3.4 READY</span>
            </div>
          </div>

          {/* ========================================================== */}
          {/* TAB 1: HOSTILE SPECIMENS QUARANTINE                        */}
          {/* ========================================================== */}
          {activeTab === 'enemies' && (
            <div className="space-y-6">
              {/* Telemetry & Matrix Status Cards */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
                      Matrix Telemetry
                    </span>
                    <ShieldAlert className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-4">
                    <div>
                      <span className="font-mono text-3xl font-black text-emerald-400">{activeEnemiesCount}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70">
                        Active Threats
                      </p>
                    </div>
                    <div className="text-white/20 text-2xl font-light">/</div>
                    <div>
                      <span className="font-mono text-3xl font-black text-rose-400">{disabledEnemyIds.size}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-rose-400/70">
                        Quarantined
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-cyan-200/70">
                    Quarantined threats are prevented from spawning in runs, letting you tailor encounters or isolate specific hazards.
                  </p>
                </div>

                {/* Universal Incursion Toggle */}
                <div className={`rounded-xl border p-4 shadow-lg transition-colors ${
                  universalIncursionActive
                    ? 'border-purple-500/50 bg-purple-950/30'
                    : 'border-white/10 bg-white/5'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-purple-400">
                      Universal Incursion
                    </span>
                    <Swords className={`h-4 w-4 ${universalIncursionActive ? 'text-purple-300' : 'text-white/40'}`} />
                  </div>
                  <h3 className="mt-2 text-base font-black text-white">
                    Cross-Map Incursion
                  </h3>
                  <p className="mt-1 text-xs text-white/60">
                    Forces enabled enemies from other factions (Bubblewash bubbles, Dust Mites, Digital Damned) to invade every map.
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleThreatUpgrade('universal-incursion')}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                      universalIncursionActive
                        ? 'border-purple-400 bg-purple-500 text-black shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                        : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {universalIncursionActive ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> All Enemies Active Everywhere
                      </>
                    ) : (
                      'Activate Universal Incursion'
                    )}
                  </button>
                </div>

                {/* Quick Batch Actions */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                      Batch Overrides
                    </span>
                    <RefreshCw className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="mt-2 text-xs text-white/60">
                    Bulk controls to enable or quarantine every target specimen in a single command.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAllEnemiesDisabled(false)}
                      className="flex items-center justify-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-900/50"
                    >
                      <Eye className="h-3.5 w-3.5" /> Enable All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllEnemiesDisabled(true)}
                      className="flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-950/40 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-900/50"
                    >
                      <EyeOff className="h-3.5 w-3.5" /> Quarantine All
                    </button>
                  </div>
                </div>
              </div>

              {/* Matrix Field Upgrades */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-cyan-400 mb-3">
                  <Sparkles className="h-3.5 w-3.5" /> Threat Defense Grid Tuning
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleThreatUpgrade('corner-magnet')}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      cornerMagnetActive
                        ? 'border-cyan-400/60 bg-cyan-950/40 text-cyan-200 shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Magnet className={`mt-0.5 h-4 w-4 shrink-0 ${cornerMagnetActive ? 'text-cyan-400' : 'text-white/40'}`} />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs">Corner Magnet</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300 font-bold">
                          {cornerMagnetActive ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
                        DVD Bouncing Icon curves toward screen corners for catastrophic corner criticals.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleThreatUpgrade('tidal-anchor')}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      tidalAnchorActive
                        ? 'border-blue-400/60 bg-blue-950/40 text-blue-200 shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Anchor className={`mt-0.5 h-4 w-4 shrink-0 ${tidalAnchorActive ? 'text-blue-400' : 'text-white/40'}`} />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs">Tidal Anchor</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-blue-300 font-bold">
                          {tidalAnchorActive ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
                        Reduces Bubble Wash suds surge displacement by 75%, anchoring your footing.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleThreatUpgrade('static-inverter')}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      staticInverterActive
                        ? 'border-amber-400/60 bg-amber-950/40 text-amber-200 shadow-sm'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Zap className={`mt-0.5 h-4 w-4 shrink-0 ${staticInverterActive ? 'text-amber-400' : 'text-white/40'}`} />
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs">Static Inverter</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-300 font-bold">
                          {staticInverterActive ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
                        Dust Mite electrical friction chains heal player shields instead of dealing shock damage.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Search & Faction Filter Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={enemySearch}
                    onChange={(e) => setEnemySearch(e.target.value)}
                    placeholder="Search threat specimen by name, id, or family..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-white/40 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ENEMY_FACTIONS.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedFaction(tag.id)}
                      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                        selectedFaction === tag.id
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold'
                          : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enemy Specimens Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEnemies.map((enemy) => {
                  const isQuarantined = disabledEnemyIds.has(enemy.id);
                  const activeAnim =
                    enemy.behavior === 'shockwave' || enemy.behavior === 'spitter' || enemy.behavior === 'charger'
                      ? 'attack'
                      : 'walk';

                  return (
                    <div
                      key={enemy.id}
                      className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                        isQuarantined
                          ? 'border-rose-500/30 bg-rose-950/15 opacity-70'
                          : 'border-white/10 bg-black/40 hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
                          <RigPortrait
                            rig={enemy.rig}
                            palette={enemy.palette}
                            anim={activeAnim}
                            size={56}
                          />
                          {isQuarantined && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                              <Lock className="h-5 w-5 text-rose-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400/80 truncate">
                              {enemy.family}
                            </span>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/60">
                              HP: {enemy.hp}
                            </span>
                          </div>
                          <h4 className={`font-bold text-sm truncate ${isQuarantined ? 'text-rose-200 line-through' : 'text-white'}`}>
                            {enemy.name}
                          </h4>
                          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-white/50">
                            <span>SPD: {enemy.speed}</span>
                            <span>·</span>
                            <span>DMG: {enemy.damage}</span>
                            <span>·</span>
                            <span>R: {enemy.radius}</span>
                          </div>
                          <div className="mt-1">
                            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/50">
                              {enemy.behavior}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-white/5 pt-2.5 flex items-center justify-between">
                        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                          isQuarantined ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {isQuarantined ? 'Quarantined' : 'Active'}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleEnemyDisabled(enemy.id)}
                          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                            isQuarantined
                              ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                              : 'border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60'
                          }`}
                        >
                          {isQuarantined ? (
                            <>
                              <Unlock className="h-3 w-3" /> Activate
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Quarantine
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredEnemies.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-12 text-center">
                  <p className="text-sm font-mono text-white/40">
                    No threat specimens matched filter &quot;{enemySearch}&quot;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: ARSENAL QUARANTINE (WEAPONS & PASSIVES)             */}
          {/* ========================================================== */}
          {activeTab === 'arsenal' && (
            <div className="space-y-6">
              {/* Arsenal Telemetry & Batch Controls */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                      Weapons Pool
                    </span>
                    <Swords className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-4">
                    <div>
                      <span className="font-mono text-3xl font-black text-emerald-400">{activeWeaponsCount}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70">
                        Active in Runs
                      </p>
                    </div>
                    <div className="text-white/20 text-2xl font-light">/</div>
                    <div>
                      <span className="font-mono text-3xl font-black text-rose-400">{disabledWeaponIds.size}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-rose-400/70">
                        Quarantined
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-amber-200/70">
                    Quarantined weapons are excluded from level-up draft cards. At least 1 active weapon is required.
                  </p>
                </div>

                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
                      Passives Pool
                    </span>
                    <Layers className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-4">
                    <div>
                      <span className="font-mono text-3xl font-black text-emerald-400">{activePassivesCount}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/70">
                        Active in Runs
                      </p>
                    </div>
                    <div className="text-white/20 text-2xl font-light">/</div>
                    <div>
                      <span className="font-mono text-3xl font-black text-rose-400">{disabledPassiveIds.size}</span>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-rose-400/70">
                        Quarantined
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-cyan-200/70">
                    Tailor your build possibilities by disabling unwanted passives or focusing exclusively on desired synergies.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-white/80">
                      Arsenal Batch Actions
                    </span>
                    <RefreshCw className="h-4 w-4 text-white/60" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAllWeaponsDisabled(false)}
                      className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-emerald-900/50"
                    >
                      Enable All Weapons
                    </button>
                    <button
                      type="button"
                      onClick={handleQuarantineAllWeaponsSafe}
                      className="rounded border border-rose-500/40 bg-rose-950/40 px-2 py-1.5 font-mono text-[11px] font-bold text-rose-300 hover:bg-rose-900/50"
                    >
                      Quarantine Weapons
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPassivesDisabled(false)}
                      className="rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-emerald-900/50"
                    >
                      Enable All Passives
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPassivesDisabled(true)}
                      className="rounded border border-rose-500/40 bg-rose-950/40 px-2 py-1.5 font-mono text-[11px] font-bold text-rose-300 hover:bg-rose-900/50"
                    >
                      Quarantine Passives
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={resetArsenalQuarantine}
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded border border-white/20 bg-white/5 py-1 font-mono text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset Full Arsenal to Default
                  </button>
                </div>
              </div>

              {/* Sub-navigation & Search Filter Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
                    <button
                      type="button"
                      onClick={() => setArsenalFilter('all')}
                      className={`rounded px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                        arsenalFilter === 'all'
                          ? 'bg-white/20 text-white'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      All Arsenal
                    </button>
                    <button
                      type="button"
                      onClick={() => setArsenalFilter('weapons')}
                      className={`rounded px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                        arsenalFilter === 'weapons'
                          ? 'bg-amber-500/30 text-amber-200'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Weapons ({filteredWeapons.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setArsenalFilter('passives')}
                      className={`rounded px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                        arsenalFilter === 'passives'
                          ? 'bg-cyan-500/30 text-cyan-200'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Passives ({filteredPassives.length})
                    </button>
                  </div>
                </div>

                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={arsenalSearch}
                    onChange={(e) => setArsenalSearch(e.target.value)}
                    placeholder="Search weapon or passive name, kind, effect..."
                    className="w-full rounded-lg border border-white/10 bg-black/40 py-1.5 pl-9 pr-3 font-mono text-xs text-white placeholder-white/40 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Weapon Kind Sub-filters (when weapons visible) */}
              {(arsenalFilter === 'all' || arsenalFilter === 'weapons') && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/40 mr-1">
                    Weapon Class:
                  </span>
                  {WEAPON_KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setWeaponKindFilter(k.id)}
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                        weaponKindFilter === k.id
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200 font-bold'
                          : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Weapons Grid */}
              {(arsenalFilter === 'all' || arsenalFilter === 'weapons') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <Swords className="h-3.5 w-3.5" /> Weapons Arsenal ({filteredWeapons.length})
                    </h4>
                    <span className="font-mono text-[10px] text-white/40">
                      Active: {activeWeaponsCount} / {WEAPONS.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredWeapons.map((weapon) => {
                      const isQuarantined = disabledWeaponIds.has(weapon.id);
                      const isLastActive = !isQuarantined && activeWeaponsCount <= 1;

                      return (
                        <div
                          key={weapon.id}
                          className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                            isQuarantined
                              ? 'border-rose-500/30 bg-rose-950/15 opacity-75'
                              : 'border-white/10 bg-black/40 hover:border-amber-500/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: weapon.color ?? '#f59e0b' }}
                                />
                                <h5 className={`font-bold text-sm ${isQuarantined ? 'text-rose-200 line-through' : 'text-white'}`}>
                                  {weapon.name}
                                </h5>
                              </div>
                              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300 shrink-0">
                                {weapon.kind}
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-white/60 leading-relaxed min-h-[36px]">
                              {weapon.description}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] text-white/50">
                              <span>DMG: {weapon.damage}</span>
                              <span>·</span>
                              <span>CD: {weapon.cooldownMs}ms</span>
                              <span>·</span>
                              <span>RNG: {weapon.range}</span>
                              {weapon.statusEffectId && (
                                <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-1 py-0.2 text-[9px] text-cyan-300 uppercase">
                                  {weapon.statusEffectId}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 border-t border-white/5 pt-2.5 flex items-center justify-between">
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                              isQuarantined ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {isQuarantined ? 'Quarantined' : 'Active'}
                            </span>

                            <button
                              type="button"
                              disabled={isLastActive}
                              onClick={() => handleToggleWeapon(weapon.id)}
                              title={isLastActive ? 'At least one weapon must remain active' : undefined}
                              className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                                isLastActive
                                  ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/30'
                                  : isQuarantined
                                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                                  : 'border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60'
                              }`}
                            >
                              {isQuarantined ? (
                                <>
                                  <Unlock className="h-3 w-3" /> Activate
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" /> Quarantine
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Passives Grid */}
              {(arsenalFilter === 'all' || arsenalFilter === 'passives') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-1">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5" /> Passive Modules ({filteredPassives.length})
                    </h4>
                    <span className="font-mono text-[10px] text-white/40">
                      Active: {activePassivesCount} / {PASSIVES.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredPassives.map((passive) => {
                      const isQuarantined = disabledPassiveIds.has(passive.id);

                      return (
                        <div
                          key={passive.id}
                          className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                            isQuarantined
                              ? 'border-rose-500/30 bg-rose-950/15 opacity-75'
                              : 'border-white/10 bg-black/40 hover:border-cyan-500/40'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h5 className={`font-bold text-sm ${isQuarantined ? 'text-rose-200 line-through' : 'text-white'}`}>
                                {passive.name}
                              </h5>
                              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-cyan-300 shrink-0">
                                Max x{passive.maxStacks}
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-white/70 leading-relaxed min-h-[36px]">
                              {passive.description}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {passive.effects.map((effect, idx) => (
                                <span
                                  key={idx}
                                  className="rounded border border-cyan-500/20 bg-cyan-950/30 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300"
                                >
                                  {effect.kind === 'stat' ? `${effect.stat} ${effect.mult ? `x${effect.mult}` : `+${effect.add}`}` : 'Special'}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-3 border-t border-white/5 pt-2.5 flex items-center justify-between">
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                              isQuarantined ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {isQuarantined ? 'Quarantined' : 'Active'}
                            </span>

                            <button
                              type="button"
                              onClick={() => togglePassiveDisabled(passive.id)}
                              className={`flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                                isQuarantined
                                  ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60'
                                  : 'border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60'
                              }`}
                            >
                              {isQuarantined ? (
                                <>
                                  <Unlock className="h-3 w-3" /> Activate
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3" /> Quarantine
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: THREAT CALIBRATIONS & SPECIAL ANOMALIES             */}
          {/* ========================================================== */}
          {activeTab === 'calibrations' && (
            <div className="space-y-6">
              {/* Header banner */}
              <div className="flex flex-col gap-2 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-purple-400">
                    <Sliders className="h-4 w-4" /> Tactical Threat Modifiers
                  </div>
                  <p className="mt-1 text-xs text-purple-200/80">
                    Calibrate hostile health pools, kinetic knockback mass, wave swarm density, approach angles, and environmental anomaly events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetThreatCalibrations}
                  className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-white/20 shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
                </button>
              </div>

              {/* Sliders Grid: HP, Mass, Density */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* 1. Health Pool Multiplier */}
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" /> Health Scaling
                    </span>
                    <span className="font-mono text-lg font-black text-rose-200">
                      {calibrations.hpMult.toFixed(2)}x
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.05"
                    value={calibrations.hpMult}
                    onChange={(e) => setThreatCalibrations({ hpMult: Number.parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 cursor-pointer"
                  />

                  <div className="flex justify-between font-mono text-[10px] text-white/40">
                    <span>0.25x (Fragile)</span>
                    <span>1.0x (Standard)</span>
                    <span>4.0x (Titan)</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { label: '0.5x', val: 0.5 },
                      { label: '1.0x', val: 1.0 },
                      { label: '1.75x', val: 1.75 },
                      { label: '3.0x', val: 3.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setThreatCalibrations({ hpMult: p.val })}
                        className={`rounded border py-1 font-mono text-[10px] font-bold ${
                          Math.abs(calibrations.hpMult - p.val) < 0.04
                            ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                            : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Mass & Inertia Multiplier */}
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <Anchor className="h-3.5 w-3.5" /> Mass &amp; Knockback
                    </span>
                    <span className="font-mono text-lg font-black text-amber-200">
                      {calibrations.massMult.toFixed(2)}x
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.25"
                    max="4.0"
                    step="0.05"
                    value={calibrations.massMult}
                    onChange={(e) => setThreatCalibrations({ massMult: Number.parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />

                  <div className="flex justify-between font-mono text-[10px] text-white/40">
                    <span>0.25x (Feather)</span>
                    <span>1.0x (Normal)</span>
                    <span>4.0x (Heavy)</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { label: '0.5x', val: 0.5 },
                      { label: '1.0x', val: 1.0 },
                      { label: '2.0x', val: 2.0 },
                      { label: '3.5x', val: 3.5 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setThreatCalibrations({ massMult: p.val })}
                        className={`rounded border py-1 font-mono text-[10px] font-bold ${
                          Math.abs(calibrations.massMult - p.val) < 0.04
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Swarm Density Multiplier */}
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      <Crosshair className="h-3.5 w-3.5" /> Swarm Density
                    </span>
                    <span className="font-mono text-lg font-black text-emerald-200">
                      {calibrations.densityMult.toFixed(2)}x
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={calibrations.densityMult}
                    onChange={(e) => setThreatCalibrations({ densityMult: Number.parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />

                  <div className="flex justify-between font-mono text-[10px] text-white/40">
                    <span>0.5x (Skirmish)</span>
                    <span>1.0x (Standard)</span>
                    <span>2.5x (Horde)</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { label: '0.5x', val: 0.5 },
                      { label: '1.0x', val: 1.0 },
                      { label: '1.5x', val: 1.5 },
                      { label: '2.0x', val: 2.0 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setThreatCalibrations({ densityMult: p.val })}
                        className={`rounded border py-1 font-mono text-[10px] font-bold ${
                          Math.abs(calibrations.densityMult - p.val) < 0.04
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Incursion Vectors & Angle Calibration */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5" /> Incursion Vector Angles &amp; Formations
                  </span>
                  <span className="font-mono text-xs text-white/50">
                    Currently: <strong className="text-cyan-300 uppercase">{calibrations.angleMode}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {ANGLE_MODES.map((mode) => {
                    const isSelected = calibrations.angleMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setThreatCalibrations({ angleMode: mode.id })}
                        className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 shadow-md shadow-cyan-950/50'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-mono">{mode.icon}</span>
                            {isSelected && (
                              <span className="rounded bg-cyan-400/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-cyan-300">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h5 className="mt-2 font-bold text-xs text-white">{mode.name}</h5>
                          <p className="mt-1 text-[11px] text-white/50 leading-relaxed">
                            {mode.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Environmental Anomaly Protocols */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Environmental Anomaly Protocols
                  </span>
                  <span className="font-mono text-xs text-white/50">
                    Active Events: <strong className="text-purple-300">{calibrations.activeEvents?.length ?? 0}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ANOMALY_EVENTS.map((event) => {
                    const isEventActive = (calibrations.activeEvents ?? []).includes(event.id);

                    return (
                      <div
                        key={event.id}
                        className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                          isEventActive
                            ? 'border-purple-500/60 bg-purple-950/30 text-purple-100 shadow-md shadow-purple-950/40'
                            : 'border-white/10 bg-white/5 text-white/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase"
                              style={{ borderColor: `${event.color}60`, color: event.color }}
                            >
                              {event.tag}
                            </span>
                            <span className="font-mono text-[10px] font-bold uppercase">
                              {isEventActive ? 'ONLINE' : 'STANDBY'}
                            </span>
                          </div>

                          <h5 className="mt-2 font-bold text-sm text-white flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: event.color }}
                            />
                            {event.name}
                          </h5>

                          <p className="mt-2 text-xs text-white/60 leading-relaxed">
                            {event.desc}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-white/40">
                            Status: {isEventActive ? 'Engaged' : 'Dormant'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleEvent(event.id)}
                            className={`flex items-center gap-1.5 rounded border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                              isEventActive
                                ? 'border-purple-400 bg-purple-500 text-black shadow-sm'
                                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                            }`}
                          >
                            {isEventActive ? (
                              <>
                                <Check className="h-3 w-3" /> Enabled
                              </>
                            ) : (
                              'Enable Anomaly'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ScreenLayout>
  );
}
