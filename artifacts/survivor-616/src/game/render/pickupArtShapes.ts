/**
 * Shared geometry for the shape-driven drop packs (Blueprint, Neon Arcade,
 * Paper Cut). One polygon list per drop archetype; each pack decides how to
 * stroke, fill and shade it. Coordinates are centred on (0,0), roughly +-10.
 */
export type Tone = 'm' | 'l' | 'd' | 'a' | 'k';
export interface Shape { pts: number[][]; tone: Tone; line?: boolean }

const TAU = Math.PI * 2;
const circ = (cx: number, cy: number, r: number, n = 14): number[][] =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
const rect = (x: number, y: number, w: number, h: number): number[][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const rot = (pts: number[][], a: number): number[][] => pts.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);

/** Wood / casing colour for the chest-like drops (everything else uses the kind colour). */
export const BODY_COLOR: Record<string, string> = {
  'loot-box': '#35558c',
  'relic-vault-chest': '#6b5a3a',
  'firefly-amber-chest': '#8a4c12',
  'mimic-chest': '#5a2a14',
  'glitch-cache': '#274a7a',
};

export function shapesFor(arch: string, key: string): Shape[] {
  switch (arch) {
    case 'gem': {
      const s = 9 * (key === 'xp-4' ? 1.35 : key === 'xp-3' ? 1.1 : key === 'xp-2' ? 0.85 : key === 'xp-1' ? 0.62 : 1);
      return [
        { tone: 'm', pts: [[0, -s], [s * 0.75, -s * 0.25], [s * 0.55, s * 0.55], [0, s], [-s * 0.55, s * 0.55], [-s * 0.75, -s * 0.25]] },
        { tone: 'l', pts: [[0, -s], [-s * 0.75, -s * 0.25], [-s * 0.2, 0]] },
        { tone: 'd', pts: [[-s * 0.2, 0], [s * 0.55, s * 0.55], [0, s]] },
        { tone: 'a', line: true, pts: [[0, -s], [-s * 0.2, 0], [0, s]] },
      ];
    }
    case 'quartz':
      return [
        { tone: 'm', pts: [[0, -10], [5.5, -4], [5.5, 4.5], [0, 10], [-5.5, 4.5], [-5.5, -4]] },
        { tone: 'l', pts: [[0, -10], [-5.5, -4], [0, 0]] },
        { tone: 'd', pts: [[0, 0], [5.5, 4.5], [0, 10]] },
        { tone: 'a', line: true, pts: [[0, -10], [0, 10]] },
      ];
    case 'plus':
      return [
        { tone: 'k', pts: rect(-8, -8, 16, 16) },
        { tone: 'a', pts: [[-2, -5.5], [2, -5.5], [2, -2], [5.5, -2], [5.5, 2], [2, 2], [2, 5.5], [-2, 5.5], [-2, 2], [-5.5, 2], [-5.5, -2], [-2, -2]] },
      ];
    case 'coin':
      return [
        { tone: 'm', pts: circ(0, 0, 6.6) },
        { tone: 'd', line: true, pts: circ(0, 0, 4.6) },
        { tone: 'a', pts: rect(-0.9, -2.6, 1.8, 5.2) },
      ];
    case 'orb':
      return [
        { tone: 'm', pts: circ(0, 0, 6.5) },
        { tone: 'l', pts: circ(-1.2, -1.2, 3) },
        { tone: 'a', line: true, pts: circ(0, 0, 10, 18) },
      ];
    case 'drop':
      return [
        { tone: 'm', pts: [[0, -9], [4, -3], [7, 2], [5.5, 6], [0, 7.5], [-5.5, 6], [-7, 2], [-4, -3]] },
        { tone: 'l', pts: [[-3, -1], [-1.5, -4], [-1.5, 2.5]] },
      ];
    case 'cell':
      return [
        { tone: 'm', pts: rect(-6.5, -10, 13, 20) },
        { tone: 'd', pts: rect(-5.5, -11, 11, 3) },
        { tone: 'd', pts: rect(-5.5, 8, 11, 3) },
        { tone: 'a', pts: rect(-2.2, -6, 4.4, 12) },
      ];
    case 'chest':
    case 'box': {
      const lid = arch === 'box'
        ? rect(-11, -8, 22, 4.5)
        : [[-11, -4], [-9, -9], [-4, -12], [4, -12], [9, -9], [11, -4]];
      return [
        { tone: 'm', pts: rect(-11, -4, 22, 13) },
        { tone: 'l', pts: lid },
        { tone: 'd', pts: rect(-9, -8, 2.2, 17) },
        { tone: 'd', pts: rect(6.8, -8, 2.2, 17) },
        { tone: 'a', pts: rect(-2, -2, 4, 5) },
      ];
    }
    case 'card':
      return [
        { tone: 'm', pts: rot(rect(-7, -10, 14, 20), -0.1) },
        { tone: 'a', line: true, pts: rot(rect(-4.5, -6.5, 9, 9), -0.1) },
        { tone: 'a', pts: rot(rect(-4.5, 5, 9, 1.8), -0.1) },
      ];
    case 'ore':
      return [
        { tone: 'k', pts: [[-9, 7], [-6, 1], [3, 0], [9, 7]] },
        { tone: 'm', pts: [[-4, 4], [-6, -4], [-1.5, -10], [1, 4]] },
        { tone: 'l', pts: [[-1.5, -10], [4, -5], [1, 4]] },
        { tone: 'd', pts: [[2, 4], [3.5, -1], [8, -3], [7, 5]] },
      ];
    case 'ingot':
      return [
        { tone: 'm', pts: [[-8, 5], [-6, -3], [7, -3], [9, 5]] },
        { tone: 'l', pts: [[-6, -3], [7, -3], [5, -6.5], [-4, -6.5]] },
        { tone: 'a', pts: rect(-5, 0, 9, 1.4) },
      ];
    case 'flask':
      return [
        { tone: 'm', pts: circ(0, 2.5, 6.5, 16) },
        { tone: 'm', pts: rect(-2.4, -7, 4.8, 6) },
        { tone: 'a', pts: [[-6, 2], [6, 2], [5, 6], [0, 9], [-5, 6]] },
        { tone: 'd', pts: rect(-2.8, -9.5, 5.6, 2.6) },
      ];
    default:
      return [{ tone: 'm', pts: circ(0, 0, 6) }];
  }
}
