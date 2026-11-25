// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
// Shared Lok looks: one set of colour themes that exists in BOTH Queens N Kings and 616 Survivor under the same ids,
// so a look a player owns can carry across games. Colours only; each game draws its own version (a Wardrobe theme in
// Queens N Kings, a menu theme in 616). Placeholder art, tiers and unlok numbers are PROPOSED.
export type SharedLookTier = "rare" | "epic" | "legendary";
export interface SharedLook {
  id: string;            // stable across games; each game prefixes it the same way ("lok-" + id)
  name: string;
  blurb: string;
  tier: SharedLookTier;
  bg: string; panel: string; accent: string; accent2: string; accentD: string; btnTop: string; btnBot: string; glow: string;
  /** How tiny souls leave this look's border in Queens N Kings. */
  soul: { color: string; motion: "rise" | "flicker" | "drift" | "orbit" | "spiral" | "zigzag" | "sink" | "slow" | "dart" | "rainbow" };
}

export const SHARED_LOOKS: readonly SharedLook[] = [
  { id: "ember-court", name: "Ember Court", blurb: "A coal-black hall lit by gold and orange embers.", tier: "rare", bg: "#100a07", panel: "#25170f", accent: "#ffb15c", accent2: "#ffe0b8", accentD: "#a35a1c", btnTop: "#5a3317", btnBot: "#341d0e", glow: "#ff8a2e", soul: { color: "#ff9a52", motion: "flicker" } },
  { id: "moss-cathedral", name: "Moss Cathedral", blurb: "Deep green stone with lichen-gold light falling through.", tier: "rare", bg: "#07100a", panel: "#12261a", accent: "#9be08a", accent2: "#e2f7c8", accentD: "#4a8a3a", btnTop: "#254d2c", btnBot: "#152e19", glow: "#d6e87a", soul: { color: "#c8ffe0", motion: "rise" } },
  { id: "tidepool-neon", name: "Tidepool Neon", blurb: "Midnight blue with coral-pink and aqua glowing in the water.", tier: "epic", bg: "#040b1a", panel: "#0b1f3a", accent: "#ff8fb3", accent2: "#d4fbff", accentD: "#b03a68", btnTop: "#1b4a6e", btnBot: "#0e2c46", glow: "#34f0e0", soul: { color: "#5fe0d0", motion: "sink" } },
  { id: "paper-moon", name: "Paper Moon", blurb: "A deep indigo night with a cream paper moon and soft pale-yellow stars.", tier: "epic", bg: "#0b0d24", panel: "#1a1f45", accent: "#f6e7a8", accent2: "#fff8dc", accentD: "#9a8a3c", btnTop: "#363c78", btnBot: "#212650", glow: "#fff3b0", soul: { color: "#f1ead8", motion: "slow" } },
  { id: "copper-rain", name: "Copper Rain", blurb: "Dark teal storm light and bright copper streaks.", tier: "epic", bg: "#05100f", panel: "#0f2826", accent: "#ff9d6b", accent2: "#ffe2d2", accentD: "#a8481c", btnTop: "#1f5a54", btnBot: "#123532", glow: "#4de0cf", soul: { color: "#bfe9ff", motion: "drift" } },
  { id: "berry-static", name: "Berry Static", blurb: "Plum black with raspberry and acid-lime that buzz against each other.", tier: "legendary", bg: "#14041a", panel: "#2c0b36", accent: "#ff6fae", accent2: "#ffd0e6", accentD: "#a31a5a", btnTop: "#5e1a66", btnBot: "#3a0e44", glow: "#c8ff3a", soul: { color: "#ff9ec7", motion: "zigzag" } },
  { id: "salt-flat", name: "Salt Flat", blurb: "Quiet slate, pale sand and a wide cold sky.", tier: "rare", bg: "#0e1218", panel: "#1e2631", accent: "#d9cfae", accent2: "#f6f1de", accentD: "#7d7452", btnTop: "#3b4655", btnBot: "#252d3a", glow: "#aee0ff", soul: { color: "#bfe9ff", motion: "drift" } },
  { id: "sunken-crown", name: "Sunken Crown", blurb: "Black-green water and a tarnished gold crown with sea-glass light.", tier: "legendary", bg: "#03100e", panel: "#082a25", accent: "#e6c35a", accent2: "#fbf0c0", accentD: "#86691a", btnTop: "#14594f", btnBot: "#0a3a33", glow: "#7af0d0", soul: { color: "#ffd86b", motion: "spiral" } },
];

export const sharedLookById = (id: string): SharedLook | undefined => SHARED_LOOKS.find((l) => l.id === id);

const toRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
/** "H S% L%" in the form 616's CSS variables use, with optional lightness and saturation overrides. */
export function hexToHsl(hex: string, opts: { l?: number; s?: number } = {}): string {
  const [r, g, b] = toRgb(hex).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(((h * 60) + 360) % 360);
  const l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return `${h} ${Math.round((opts.s ?? s * 100))}% ${Math.round(opts.l ?? l * 100)}%`;
}

/** The 616 CSS custom properties for a look (the same names the existing menu themes set). */
export function sharedLookCssVars(l: SharedLook): Record<string, string> {
  const bg = hexToHsl(l.bg), fg = hexToHsl(l.accent2, { l: 95 }), prim = hexToHsl(l.accent);
  return {
    "--background": bg, "--foreground": fg, "--card": hexToHsl(l.panel), "--card-foreground": fg, "--primary": prim, "--primary-foreground": bg,
    "--secondary": hexToHsl(l.btnBot), "--secondary-foreground": fg, "--muted": hexToHsl(l.panel, { l: 11 }), "--muted-foreground": hexToHsl(l.accent, { s: 24, l: 68 }),
    "--accent": hexToHsl(l.accentD, { l: 15 }), "--accent-foreground": prim, "--border": hexToHsl(l.btnTop), "--input": hexToHsl(l.btnTop), "--ring": prim,
  };
}
