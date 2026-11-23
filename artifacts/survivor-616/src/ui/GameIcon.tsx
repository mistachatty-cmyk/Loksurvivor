import type { CSSProperties } from 'react';
import {
  Flame, Snowflake, Hourglass, Zap, Bug, Shield, Wind, Sparkles, Moon, Swords, Bomb, Spade,
  Gauge, WandSparkles, Gem, BatteryFull, Cog, FlaskConical, Dog, CircuitBoard, Hexagon, Lock,
  PartyPopper, Radar, TriangleAlert, Waves, Crown, Eye,
  type LucideIcon,
} from 'lucide-react';

/**
 * Design standard: no emoji anywhere in Lok products. Data tables store an icon KEY
 * (never a pictograph); this component draws it as a line icon that inherits text color.
 */
export const GAME_ICONS = {
  fire: Flame, freeze: Snowflake, slow: Hourglass, shock: Zap, glitch: Bug, guard: Shield,
  aero: Wind, light: Sparkles, dark: Moon, striker: Swords, blaster: Bomb, trickster: Spade,
  speedster: Gauge, weaver: WandSparkles, gem: Gem, battery: BatteryFull, gear: Cog,
  vial: FlaskConical, wolf: Dog, frog: CircuitBoard, hive: Hexagon, lock: Lock,
  party: PartyPopper, radar: Radar, warning: TriangleAlert, waves: Waves, crown: Crown, eye: Eye,
} as const satisfies Record<string, LucideIcon>;

export type GameIconKey = keyof typeof GAME_ICONS;

interface GameIconProps {
  name: string;
  className?: string;
  style?: CSSProperties;
  size?: number | string;
}

/** Unknown names fall back to plain text so legacy non-emoji glyphs keep rendering. */
export function GameIcon({ name, className, style, size = '1em' }: GameIconProps) {
  const Icon = (GAME_ICONS as Record<string, LucideIcon>)[name];
  if (!Icon) return <>{name}</>;
  return (
    <Icon
      aria-hidden="true"
      width={size}
      height={size}
      strokeWidth={2.25}
      className={className}
      style={{ display: 'inline-block', verticalAlign: '-0.125em', ...style }}
    />
  );
}
