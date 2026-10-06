import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  Sparkles,
  ArrowLeft,
  Swords,
  Coins,
  Shield,
  Zap,
  Flame,
  CheckCircle2,
  Heart,
  BookOpen,
  Wheat,
  Star,
  Activity,
  Layers,
  Compass,
  MapPin,
} from 'lucide-react';
import { useMeta } from '@/game/state/metaStore';
import { LOKPET_VARIANTS } from '@/game/data/lokPets';
import type { LokPetVariantDef } from '@/game/types';
import { LokPetIcon } from './LokPetVariantSheet';
import { LorePopup } from './LorePopup';
import { RigPortrait } from './RigPortrait';
import { JEREMEY_FROGSTER } from '@/game/data/npcCast';

export interface DustMiteRancherPanelProps {
  onBack: () => void;
  onOpenLokPetBattle?: () => void;
  initialCategory?: 'mites' | 'frogs';
}

interface RanchPetOffering {
  variantId: string;
  category: 'mites' | 'sloths' | 'frogs' | 'birds';
  credCost: number;
  badge: string;
  tagline: string;
  hp: number;
  atk: number;
  spd: number;
}

const RANCH_OFFERINGS: RanchPetOffering[] = [
  // Dust Mites
  {
    variantId: 'byte-dust-mite',
    category: 'mites',
    credCost: 150,
    badge: 'Common Data Swarmer',
    tagline: 'Scavenges corrupted memory leaks and bites in fast micro-bursts.',
    hp: 42,
    atk: 9,
    spd: 130,
  },
  {
    variantId: 'neon-dust-roller',
    category: 'mites',
    credCost: 220,
    badge: 'Charged Kinetic Roller',
    tagline: 'Compresses into a dense rolling orb to bowl through enemy formations.',
    hp: 55,
    atk: 14,
    spd: 145,
  },
  {
    variantId: 'amber-dust-mite',
    category: 'mites',
    credCost: 280,
    badge: 'Rare Firewall Armored',
    tagline: 'Crystallized in silicon resin; projects impenetrable tactical shields.',
    hp: 75,
    atk: 18,
    spd: 110,
  },
  {
    variantId: 'void-dust-mite',
    category: 'mites',
    credCost: 340,
    badge: 'Mythic Singularity Vacuum',
    tagline: 'Swallows orphaned heap memory and draws hostile projectiles into the void.',
    hp: 92,
    atk: 25,
    spd: 125,
  },

  // Data Sloths
  {
    variantId: 'chrono-sloth',
    category: 'sloths',
    credCost: 180,
    badge: 'Chrono Time-Lag Unit',
    tagline: 'Suspended in infinite recursion; dilates local time to slow all enemy attacks.',
    hp: 68,
    atk: 12,
    spd: 75,
  },
  {
    variantId: 'chill-byte-sloth',
    category: 'sloths',
    credCost: 250,
    badge: 'Sub-Zero Cryo Daemon',
    tagline: 'Hangs from memory rafters while pulsing expanding frost waves.',
    hp: 80,
    atk: 17,
    spd: 70,
  },
  {
    variantId: 'quantum-sloth',
    category: 'sloths',
    credCost: 350,
    badge: 'Mythic Quantum Phase',
    tagline: 'Appears utterly motionless, but teleports instantaneously when attacked.',
    hp: 98,
    atk: 24,
    spd: 85,
  },

  // Circuit Frogs
  {
    variantId: 'circuit-frog',
    category: 'frogs',
    credCost: 170,
    badge: 'Electric Voltage Leaper',
    tagline: 'Gold-plated conductive legs that release thunderous electric croaks.',
    hp: 50,
    atk: 15,
    spd: 135,
  },
  {
    variantId: 'toxic-data-toad',
    category: 'frogs',
    credCost: 240,
    badge: 'Corrosive Byte Toad',
    tagline: 'Spits memory-corrupting bile that melts enemy armor and shields.',
    hp: 64,
    atk: 19,
    spd: 105,
  },
  {
    variantId: 'neon-bullfrog',
    category: 'frogs',
    credCost: 320,
    badge: 'Seismic Sub-Woofer Elite',
    tagline: 'Deep bass throat pouch that sends seismic shockwaves flattening swarms.',
    hp: 88,
    atk: 26,
    spd: 115,
  },

  // Pixel Birds
  {
    variantId: 'bit-raven',
    category: 'birds',
    credCost: 175,
    badge: 'Packet Scavenger',
    tagline: 'Sharp vector wings patrol overhead thermals and drop explosive data clusters.',
    hp: 45,
    atk: 16,
    spd: 150,
  },
  {
    variantId: 'cyber-falcon',
    category: 'birds',
    credCost: 290,
    badge: 'Mach-Vector Pursuit Falcon',
    tagline: 'Accelerates past Mach 2 vectors to cleave elite targets with hardlight talons.',
    hp: 72,
    atk: 28,
    spd: 175,
  },
  {
    variantId: 'pixel-sparrow',
    category: 'birds',
    credCost: 190,
    badge: 'High-Frequency Flock Sprite',
    tagline: 'Rapid agile flyer that creates decoy afterimages and static arcs.',
    hp: 48,
    atk: 14,
    spd: 160,
  },
];

interface MinesDigSite {
  id: string;
  name: string;
  depth: string;
  description: string;
  species: string[];
  variantIds: string[];
  credCost: number;
  accent: string;
}

const MINES_DIG_SITES: MinesDigSite[] = [
  {
    id: 'site-silicon-vein',
    name: 'Sub-Level 9 Amber Silicon Quarry',
    depth: '1,400m Sub-Bedrock',
    description: 'Ancient motherboard strata where fossilized cache bytes crystalize into wild Dust Mite clusters.',
    species: ['Byte Dust-Mite', 'Neon Dust-Roller', 'Amber Dust-Mite', 'Void Dust-Mite'],
    variantIds: ['byte-dust-mite', 'neon-dust-roller', 'amber-dust-mite', 'void-dust-mite'],
    credCost: 160,
    accent: '#f59e0b',
  },
  {
    id: 'site-cryo-lag',
    name: 'Cryo-Bus Suspended Memory Caverns',
    depth: '2,200m Sub-Bedrock',
    description: 'Chilled subterranean bus ducts frozen in perpetual lag where wild synthetic Chrono-Sloths hibernate.',
    species: ['Chrono Sloth', 'Chill-Byte Sloth', 'Quantum Sloth'],
    variantIds: ['chrono-sloth', 'chill-byte-sloth', 'quantum-sloth'],
    credCost: 240,
    accent: '#818cf8',
  },
  {
    id: 'site-acid-marsh',
    name: 'Conductive Byte Swamp & Sump',
    depth: '980m Drainage Wing',
    description: 'Fluorescent runoff pools where electrified circuit frogs nest along live copper conduits.',
    species: ['Circuit Frog', 'Toxic Data-Toad', 'Neon Bullfrog'],
    variantIds: ['circuit-frog', 'toxic-data-toad', 'neon-bullfrog'],
    credCost: 200,
    accent: '#34d399',
  },
  {
    id: 'site-stratosphere-spire',
    name: 'Stratosphere Corona Thermal Ridge',
    depth: 'Upper Digital Atmosphere',
    description: 'Floating solar collector masts where high-frequency vector pixel birds cruise digital air currents.',
    species: ['Bit-Raven', 'Cyber-Falcon', 'Pixel-Sparrow'],
    variantIds: ['bit-raven', 'cyber-falcon', 'pixel-sparrow'],
    credCost: 220,
    accent: '#38bdf8',
  },
];

export function DustMiteRancherPanel({ onBack, onOpenLokPetBattle, initialCategory = 'mites' }: DustMiteRancherPanelProps) {
  const { meta, adoptRancherPet, feedRanchKibble, toggleFavoriteLokPet, setLokPetLoadout } = useMeta();
  const [selectedCategory, setSelectedCategory] = useState<'mites' | 'sloths' | 'frogs' | 'birds' | 'mines'>(initialCategory);
  const [showLore, setShowLore] = useState(false);
  const [adoptionMessage, setAdoptionMessage] = useState<string | null>(null);
  const [excavatingSite, setExcavatingSite] = useState<string | null>(null);

  const activeOfferings = RANCH_OFFERINGS.filter((o) => o.category === selectedCategory);

  const handleAdopt = (offering: RanchPetOffering, variant: LokPetVariantDef) => {
    if (meta.cred < offering.credCost) {
      setAdoptionMessage(`Not enough Cred! You need ${offering.credCost} Cred, but only have ${meta.cred}.`);
      return;
    }
    adoptRancherPet(offering.variantId, offering.credCost);
    setAdoptionMessage(`Successfully adopted ${variant.name}! It is now registered in your collection & battle kennel.`);
    setTimeout(() => setAdoptionMessage(null), 4000);
  };

  const handleExcavate = (siteId: string, siteName: string, possibleVariantIds: string[], credCost: number) => {
    if (meta.cred < credCost) {
      setAdoptionMessage(`Not enough Cred to fund deep excavation in ${siteName}! (Requires ${credCost} Cred)`);
      return;
    }
    setExcavatingSite(siteId);
    setTimeout(() => {
      const chosenVariantId = possibleVariantIds[Math.floor(Math.random() * possibleVariantIds.length)] || possibleVariantIds[0];
      const variant = LOKPET_VARIANTS.find((v) => v.id === chosenVariantId);
      adoptRancherPet(chosenVariantId, credCost);
      setExcavatingSite(null);
      setAdoptionMessage(`Excavation Successful in ${siteName}! Recovered pristine synthetic specimen: ${variant?.name || 'Wild Data-Pet'}!`);
      setTimeout(() => setAdoptionMessage(null), 5000);
    }, 1200);
  };

  const handleFeed = (petId: string, name: string) => {
    const kibbleCost = 50;
    if (meta.cred < kibbleCost) {
      setAdoptionMessage(`Need ${kibbleCost} Cred to purchase Byte-Kibble!`);
      return;
    }
    feedRanchKibble(petId, kibbleCost);
    setAdoptionMessage(`Fed premium Byte-Kibble to ${name}! Level increased & stamina fully recharged.`);
    setTimeout(() => setAdoptionMessage(null), 3500);
  };

  const handleEquipCompanion = (petId: string) => {
    setLokPetLoadout([petId]);
    setAdoptionMessage(`Assigned as your active field companion!`);
    setTimeout(() => setAdoptionMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e0a05] via-[#140e07] to-black text-amber-50 p-4 sm:p-6 font-sans">
      {/* Top Header */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/30 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 border border-amber-500/40 bg-black/60 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-950/40 hover:text-white"
            data-testid="button-rancher-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Hideout</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-amber-100">
                {selectedCategory === 'frogs' ? "Jeremey Frogster's Circuit Frog Ranch" : "Barnaby's Dust Mite & Data-Pet Ranch"}
              </h1>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
              {selectedCategory === 'frogs' ? 'Coolant Conduit · Circuit Frog Habitat' : 'Sub-Conduit Sector 9 · Pure Non-Organic Synthetic Data Life'}
            </p>
          </div>
        </div>

        {/* Currency & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-amber-500/40 bg-amber-950/30 px-3 py-1.5">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="font-mono text-sm font-black text-amber-200">{meta.cred} CRED</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLore(true)}
            className="flex items-center gap-1.5 border border-red-500/60 bg-red-950/40 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-red-300 transition-colors hover:border-red-400 hover:text-white"
            data-testid="button-rancher-lore"
          >
            <BookOpen className="h-3.5 w-3.5 text-red-400" />
            <span>Digi-Verse Lore</span>
          </button>

          {onOpenLokPetBattle && (
            <button
              type="button"
              onClick={onOpenLokPetBattle}
              className="flex items-center gap-1.5 border border-cyan-400/60 bg-cyan-950/40 px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:border-cyan-300 hover:text-white shadow-[0_0_12px_rgba(34,211,238,0.2)]"
              data-testid="button-rancher-arena"
            >
              <Swords className="h-4 w-4 text-cyan-300" />
              <span>Battle Arena</span>
            </button>
          )}
        </div>
      </div>

      {/* Rancher Dialogue & Philosophy Banner */}
      <div className="max-w-6xl mx-auto mt-4 border border-amber-500/30 bg-amber-950/20 p-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="h-28 w-28 shrink-0 grid place-items-center border-2 border-amber-500/60 bg-amber-950/60 shadow-[0_0_15px_rgba(245,158,11,0.25)]" data-testid={selectedCategory === 'frogs' ? 'portrait-jeremey-frogster' : undefined}>
            {selectedCategory === 'frogs'
              ? <RigPortrait rig={JEREMEY_FROGSTER.rig} palette={JEREMEY_FROGSTER.palette} size={106} />
              : <Wheat className="h-8 w-8 text-amber-400" />}
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black uppercase tracking-widest text-amber-300">
                {selectedCategory === 'frogs' ? 'Jeremey Frogster // Circuit Frog Rancher' : 'Barnaby Bit-Herder // Master Rancher'}
              </span>
              <span className="border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200">
                {selectedCategory === 'frogs' ? 'GRAY HAIR · GLASSES · COWBOY HAT' : '100% NON-ORGANIC CODE'}
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-amber-100/90 font-serif italic">
              {selectedCategory === 'frogs'
                ? '“The coolant channels are their trails. Give a Circuit Frog room to jump, and it will find a path no patrol can predict. Jeramy keeps the beat upstairs; I keep these little conductors safe down here.”'
                : <>"Howdy, survivor! Folks who woke up after the Great Eclipse keep looking for fur and meat. Let me tell you straight: every single critter on this ranch is <strong>pure executable bytecode</strong>! Zero biology, zero organic cells, zero disease. They eat memory bloat, roll like kinetic pinballs, and shred ARCHON's drones in the Arena. Pick you out a fine battle mite, a chill-byte sloth, a circuit toad, or a pixel hawk. Feed 'em high-density Byte-Kibble and watch 'em dominate!"</>}
            </p>
          </div>
        </div>

        {adoptionMessage && (
          <div className="mt-3 border border-amber-400 bg-amber-500/20 p-2.5 text-center font-mono text-xs font-bold text-amber-100">
            {adoptionMessage}
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="max-w-6xl mx-auto mt-6 flex flex-wrap gap-2 border-b border-amber-500/20 pb-3">
        <button
          type="button"
          onClick={() => setSelectedCategory('mites')}
          className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
            selectedCategory === 'mites'
              ? 'border-amber-400 bg-amber-500/25 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'border-amber-500/30 bg-black/40 text-amber-300/70 hover:border-amber-400/60 hover:text-white'
          }`}
          data-testid="tab-ranch-mites"
        >
          <Bug className="h-4 w-4" />
          <span>Dust Mites ({RANCH_OFFERINGS.filter(o => o.category === 'mites').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('sloths')}
          className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
            selectedCategory === 'sloths'
              ? 'border-indigo-400 bg-indigo-500/25 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
              : 'border-amber-500/30 bg-black/40 text-amber-300/70 hover:border-indigo-400/60 hover:text-white'
          }`}
          data-testid="tab-ranch-sloths"
        >
          <Activity className="h-4 w-4" />
          <span>Data Sloths ({RANCH_OFFERINGS.filter(o => o.category === 'sloths').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('frogs')}
          className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
            selectedCategory === 'frogs'
              ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'border-amber-500/30 bg-black/40 text-amber-300/70 hover:border-emerald-400/60 hover:text-white'
          }`}
          data-testid="tab-ranch-frogs"
        >
          <Zap className="h-4 w-4" />
          <span>Circuit Frogs ({RANCH_OFFERINGS.filter(o => o.category === 'frogs').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('birds')}
          className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
            selectedCategory === 'birds'
              ? 'border-sky-400 bg-sky-500/25 text-sky-100 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
              : 'border-amber-500/30 bg-black/40 text-amber-300/70 hover:border-sky-400/60 hover:text-white'
          }`}
          data-testid="tab-ranch-birds"
        >
          <Sparkles className="h-4 w-4" />
          <span>Pixel Birds ({RANCH_OFFERINGS.filter(o => o.category === 'birds').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('mines')}
          className={`flex items-center gap-2 border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
            selectedCategory === 'mines'
              ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'border-amber-500/30 bg-black/40 text-amber-300/70 hover:border-red-400/60 hover:text-white'
          }`}
          data-testid="tab-ranch-mines"
        >
          <Compass className="h-4 w-4 text-red-400" />
          <span>Mines Excavation ({MINES_DIG_SITES.length})</span>
        </button>
      </div>

      {/* Offerings Grid vs Mines Excavation View */}
      {selectedCategory === 'mines' ? (
        <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {MINES_DIG_SITES.map((site) => {
            const isExcavating = excavatingSite === site.id;

            return (
              <div
                key={site.id}
                className="border border-red-500/40 bg-gradient-to-b from-red-950/25 via-black to-black p-5 flex flex-col justify-between hover:border-red-400 transition-all shadow-xl relative overflow-hidden"
                data-testid={`card-mines-site-${site.id}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-[9px] font-black uppercase tracking-wider text-red-300 border border-red-500/40 px-2 py-0.5 bg-red-950/40">
                      Depth: {site.depth}
                    </span>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-red-400" />
                      Sub-Level Sector
                    </span>
                  </div>

                  <h3 className="text-lg font-black uppercase tracking-tight text-white mt-1">
                    {site.name}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-red-100/85">
                    {site.description}
                  </p>

                  <div className="mt-3.5 border-t border-red-500/20 pt-2.5">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-red-300 font-bold mb-1.5">
                      Indigenous Synthetic Species Detected:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {site.species.map((sp) => (
                        <span
                          key={sp}
                          className="border border-red-500/30 bg-black/60 px-2 py-0.5 font-mono text-[9px] text-amber-200"
                        >
                          {sp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-red-500/30 flex items-center justify-between gap-3">
                  <div className="font-mono text-sm font-black text-amber-300">
                    {site.credCost} CRED
                  </div>
                  <button
                    type="button"
                    disabled={isExcavating}
                    onClick={() => handleExcavate(site.id, site.name, site.variantIds, site.credCost)}
                    className="flex items-center gap-2 border border-red-400 bg-red-600/30 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-red-100 hover:bg-red-500/50 hover:text-white transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)] disabled:opacity-50"
                    data-testid={`button-excavate-${site.id}`}
                  >
                    <Compass className={`h-4 w-4 ${isExcavating ? 'animate-spin' : ''}`} />
                    <span>{isExcavating ? 'Excavating...' : 'Excavate Wild Data-Pet'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-6xl mx-auto mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeOfferings.map((offering) => {
          const variant = LOKPET_VARIANTS.find((v) => v.id === offering.variantId);
          if (!variant) return null;
          const alreadyOwned = meta.savedLokPets.some((p) => p.roll.variantId === offering.variantId);

          return (
            <div
              key={offering.variantId}
              className="border border-amber-500/40 bg-black/60 p-4 flex flex-col justify-between hover:border-amber-400 transition-colors shadow-lg relative group"
              data-testid={`card-ranch-pet-${offering.variantId}`}
            >
              <div>
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/30 px-1.5 py-0.5">
                    {offering.badge}
                  </span>
                  {alreadyOwned && (
                    <span className="flex items-center gap-1 font-mono text-[8px] font-bold uppercase text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Owned
                    </span>
                  )}
                </div>

                {/* Animated Sprite Portrait */}
                <div className="flex items-center justify-center py-3 bg-amber-950/20 border border-amber-500/20 my-2">
                  <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} size={64} />
                </div>

                {/* Pet Name & Details */}
                <h3 className="text-base font-black uppercase tracking-wide text-white mt-1">
                  {variant.name}
                </h3>
                <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400/80">
                  {variant.family} · 100% Data Fauna
                </p>

                <p className="mt-1.5 text-xs leading-relaxed text-amber-100/80">
                  {offering.tagline}
                </p>

                {/* Stats Bar */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-amber-500/20 pt-2 font-mono text-[10px]">
                  <div className="bg-amber-950/40 p-1 text-center border border-amber-500/20">
                    <span className="text-amber-400 block text-[8px]">HP</span>
                    <span className="font-bold text-white">{offering.hp}</span>
                  </div>
                  <div className="bg-amber-950/40 p-1 text-center border border-amber-500/20">
                    <span className="text-red-400 block text-[8px]">ATK</span>
                    <span className="font-bold text-white">{offering.atk}</span>
                  </div>
                  <div className="bg-amber-950/40 p-1 text-center border border-amber-500/20">
                    <span className="text-cyan-400 block text-[8px]">SPD</span>
                    <span className="font-bold text-white">{offering.spd}</span>
                  </div>
                </div>

                {/* Special Ability Pill */}
                {variant.specialAbility && (
                  <div className="mt-2.5 border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-200">
                    <span className="text-amber-400 font-bold uppercase">Ability: </span>
                    {variant.specialAbility.replace('-', ' ')}
                  </div>
                )}
              </div>

              {/* Adoption Button */}
              <div className="mt-4 pt-3 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => handleAdopt(offering, variant)}
                  disabled={meta.cred < offering.credCost}
                  className={`w-full py-2.5 font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    meta.cred >= offering.credCost
                      ? 'border-amber-400 bg-amber-500/25 text-amber-100 hover:bg-amber-500/40 hover:border-amber-300 active:scale-[0.98]'
                      : 'border-white/10 bg-white/5 text-muted-foreground cursor-not-allowed'
                  }`}
                  data-testid={`button-adopt-${offering.variantId}`}
                >
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span>Adopt for {offering.credCost} Cred</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}

      {/* Your Adopted Ranch Data-Pets & Pasture Feed Station */}
      <div className="max-w-6xl mx-auto mt-10 border border-amber-500/30 bg-black/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Wheat className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-black uppercase tracking-wide text-white">
              Ranch Pasture & Feed Station
            </h2>
          </div>
          <p className="font-mono text-xs text-amber-300/80">
            Feed Byte-Kibble (50 Cred) to recharge Stamina & Level up your data pets!
          </p>
        </div>

        {meta.savedLokPets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">
            No data pets adopted yet! Pick out a dust mite, sloth, frog, or bird above to start your ranch crew.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {meta.savedLokPets.map((pet) => {
              const variant = LOKPET_VARIANTS.find((v) => v.id === pet.roll.variantId);
              if (!variant) return null;
              const isEquipped = meta.selectedLokPetIds.includes(pet.id);

              return (
                <div
                  key={pet.id}
                  className={`border p-3 bg-amber-950/20 flex items-center justify-between gap-3 transition-colors ${
                    isEquipped ? 'border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-amber-500/30'
                  }`}
                  data-testid={`kennel-pet-${pet.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} size={48} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-black uppercase text-xs text-white truncate">{variant.name}</p>
                        <span className="font-mono text-[9px] text-amber-400 font-bold">Lv.{pet.level || 1}</span>
                      </div>
                      <p className="font-mono text-[9px] text-amber-300/70 truncate">{variant.family} · Pure Code</p>
                      <p className="font-mono text-[8px] text-muted-foreground">
                        Stamina: {pet.stamina}/3 · Battles: {pet.battlesWon || 0}W/{pet.battlesFought || 0}F
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleFeed(pet.id, variant.name)}
                      className="border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/30 transition-colors"
                      data-testid={`button-feed-${pet.id}`}
                    >
                      Feed (50c)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEquipCompanion(pet.id)}
                      className={`border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        isEquipped
                          ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200'
                          : 'border-white/20 bg-black/40 text-muted-foreground hover:text-white hover:border-white/40'
                      }`}
                      data-testid={`button-equip-${pet.id}`}
                    >
                      {isEquipped ? 'Active' : 'Equip'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lore Popup Modal */}
      <AnimatePresence>
        {showLore && <LorePopup onClose={() => setShowLore(false)} initialChapterId={selectedCategory === 'frogs' ? 'frogster-twins' : 'data-pets-pure-synthetic-fauna'} />}
      </AnimatePresence>
    </div>
  );
}

export default DustMiteRancherPanel;
