import type { GraphicsQuality, RuntimePerformanceTier } from '@/game/types';

export interface RuntimeCapabilities {
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  mobile: boolean;
}

/** Capability-based rather than model-name sniffing so new phones inherit
 * sane behavior without waiting for a device catalog update. */
export function classifyRuntimePerformance(capabilities: RuntimeCapabilities): RuntimePerformanceTier {
  const cores = Math.max(1, capabilities.hardwareConcurrency ?? 2);
  const memory = capabilities.deviceMemoryGb;
  if (capabilities.mobile) {
    if (cores >= 6 && (memory === undefined || memory >= 4)) return 'high-mobile';
    if (cores >= 4 && (memory === undefined || memory >= 2)) return 'standard-mobile';
    return 'constrained-mobile';
  }
  return cores >= 8 && (memory === undefined || memory >= 8) ? 'desktop' : 'standard-mobile';
}

export function detectRuntimePerformanceTier(): RuntimePerformanceTier {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'high-mobile';
  const extendedNavigator = navigator as Navigator & { deviceMemory?: number };
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches);
  return classifyRuntimePerformance({
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGb: extendedNavigator.deviceMemory,
    mobile,
  });
}

const MILLION_HORDE_CAPS: Record<RuntimePerformanceTier, Record<GraphicsQuality, number>> = {
  'constrained-mobile': { performance: 120, balanced: 180, high: 240 },
  'standard-mobile': { performance: 220, balanced: 320, high: 420 },
  'high-mobile': { performance: 300, balanced: 480, high: 720 },
  desktop: { performance: 420, balanced: 700, high: 1000 },
};

/** Maximum fully simulated actors for Million Horde. Everything beyond this
 * stays in the aggregated population layer and never allocates actor objects. */
export function millionHordeActorCap(tier: RuntimePerformanceTier, quality: GraphicsQuality): number {
  return MILLION_HORDE_CAPS[tier][quality];
}

export const RUNTIME_TIER_LABELS: Record<RuntimePerformanceTier, string> = {
  'constrained-mobile': 'Compatibility phone',
  'standard-mobile': 'Standard phone / browser',
  'high-mobile': 'iPhone 17 Pro-class',
  desktop: 'Desktop browser',
};
