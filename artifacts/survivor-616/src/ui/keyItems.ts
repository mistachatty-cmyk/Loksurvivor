import { Compass, Droplet, Eye, Sparkles, Zap } from 'lucide-react';

/** Key equipment that stays in the permanent inventory. Shared by the Workshop and the Inventory screen. */
export const KEY_ITEM_DEFS = [
  {
    id: 'digiscope',
    name: 'Digi-Scope Sensor',
    tier: 'Standard Gear',
    icon: Compass,
    color: '#38bdf8',
    description: 'Standard issue high-frequency data scanner. Reveals invisible glitch markers, hidden secret routes, and trapped data nodes.',
    effectLabel: 'Reveals hidden data caches & glitch rifts across all districts.',
  },
  {
    id: 'mining-helmet',
    name: "Sub-Level Carbide Miner's Helmet",
    tier: 'Light Tier I',
    icon: Eye,
    color: '#f59e0b',
    description: 'Heavy subterranean halogen headlamp. Eliminates pitch-black blindness on deep subterranean maps and expands base vision by +30%.',
    effectLabel: '+30% Vision Radius · Pierces Abyssal Darkness & Subterranean fog.',
  },
  {
    id: 'firefly-lantern',
    name: 'Bioluminescent Firefly Jar',
    tier: 'Light Tier II',
    icon: Zap,
    color: '#fbbf24',
    description: 'A pressurized vacuum jar teeming with living glowing fireflies. Emits a pulsating warm perimeter and highlights nearby loot in the dark.',
    effectLabel: '+60% Vision Radius · Ambient firefly glow reveals distant pickups.',
  },
  {
    id: 'phosphor-crown',
    name: 'Apex Phosphor Crown',
    tier: 'Light Tier III (Master)',
    icon: Sparkles,
    color: '#facc15',
    description: 'A radiant crown forged from high-density phosphor ore and diamond quartz. Radiates an incandescent field that forces all enemies to emit glowing halos.',
    effectLabel: '+110% Vision Radius · Enemies radiate glowing halos in pitch darkness.',
  },
  {
    id: 'bag-of-water',
    name: "Bag o' Water",
    tier: 'Hazard Survival Gear',
    icon: Droplet,
    color: '#06b6d4',
    description: 'Pressurized hydraulic fire extinguisher flask. Automatically douses fiery floor hazards and puts out burning status effects on contact.',
    effectLabel: 'Automatically douses hot floor hazards & extinguishes fire damage.',
  },
];

/** The crown can also come from the Forge, so a crafted relic counts as owning it. */
export function keyItemOwned(id: string, ownedKeyItemIds: ReadonlySet<string>, craftedRelicIds: ReadonlySet<string>): boolean {
  return ownedKeyItemIds.has(id) || (id === 'phosphor-crown' && craftedRelicIds.has('phosphor-crown'));
}
