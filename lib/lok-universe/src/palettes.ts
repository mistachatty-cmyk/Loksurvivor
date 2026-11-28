// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
// Shared GSIX theme palette registry: the 4-slot token contract, the curated base themes (Grand Rapids / 616, Michigan,
// Midwest, Americana) and the deterministic remix rules that multiply them. Source: the "GSIX 616 & Midwest Game Palettes
// Master Registry" (Drive, 2026-11-28). Pure data and pure functions: no Math.random, no clock, no DOM, so every game and
// the hub derive the same result from the same id. Games map the 4 tokens onto their own sprite/shader slots.

export interface PaletteTokens {
  /** The main body/hull color of a theme. */
  primary: string;
  /** Supporting trim color. */
  secondary: string;
  /** The highlight: HUD pips, sparks, outlines. */
  accent: string;
  /** The dark ground everything sits on. */
  base: string;
}

export interface PaletteFx {
  glow: string;
  hudBorder: string;
  particleTint: string;
}

export type PaletteVariant = "base" | "midnight" | "retro16" | "winter" | "autumn";
/** Variants that are separate unlockables. Winter and autumn are overlays on a theme you already own. */
export const UNLOCKABLE_VARIANTS: readonly PaletteVariant[] = ["base", "midnight", "retro16"];
export const SEASON_VARIANTS: readonly PaletteVariant[] = ["winter", "autumn"];
export const ALL_VARIANTS: readonly PaletteVariant[] = ["base", "midnight", "retro16", "winter", "autumn"];

export type PaletteTier = "standard" | "uncommon" | "rare" | "legendary";
export type PaletteGroup = "gr" | "mi" | "mw" | "us";
export const PALETTE_GROUP_LABEL: Record<PaletteGroup, string> = {
  gr: "Grand Rapids (616)",
  mi: "Michigan",
  mw: "Midwest",
  us: "Americana",
};

export interface PaletteUnlockHints {
  /** How the theme is earned in each game (free-text hints; a game maps them onto its own zones and achievements). */
  survivor616: string;
  queensAndKings: string;
}

export interface BasePaletteDef {
  id: string;
  name: string;
  group: PaletteGroup;
  region: string;
  reference: string;
  tokens: PaletteTokens;
  fx: PaletteFx;
  tier: PaletteTier;
  /** A starter theme is free from the first launch in every game. */
  starter: boolean;
  unlock: PaletteUnlockHints;
}

export interface ThemePalette extends Omit<BasePaletteDef, "id"> {
  id: string;
  baseId: string;
  variant: PaletteVariant;
}

// ---------------------------------------------------------------- color math

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const HEX = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex: string): [number, number, number] {
  if (!HEX.test(hex)) throw new Error(`bad hex ${hex}`);
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
function hexToHsl(hex: string): [number, number, number] {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgbToHex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
}
export function saturationOf(hex: string): number { return hexToHsl(hex)[1]; }
/** Adds `amount` (0..1) to a color's HSL saturation. */
export function boostSaturation(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, clamp01(s + amount), l);
}
/** Snap one 8-bit channel to the nearest 5-bit step and expand back to 8 bits (SNES/Genesis-class RGB555). */
export function snap555(channel: number): number {
  const five = Math.round((Math.min(255, Math.max(0, channel)) / 255) * 31);
  return (five << 3) | (five >> 2);
}
export function snapHex555(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(snap555(r), snap555(g), snap555(b));
}
/** Relative luminance, 0..1. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ------------------------------------------------------------------ data
// [id, name, reference, primary, secondary, accent, base]
type Row = readonly [string, string, string, string, string, string, string];

const GR: readonly Row[] = [
  ["gr-01", "Crash the Net", "West Michigan Whitecaps (LMCU Ballpark)", "#002D72", "#FFFFFF", "#D50032", "#081226"],
  ["gr-02", "Van Andel Ice", "Grand Rapids Griffins (Red Wings affiliate)", "#CE1126", "#C8A961", "#FFFFFF", "#111111"],
  ["gr-03", "Calder Plaza", "La Grande Vitesse orange-red steel & concrete", "#E83E18", "#9FA4A9", "#FFFFFF", "#1D2024"],
  ["gr-04", "Blue Bridge Night", "Grand River truss bridge & LED uplighting", "#0057E7", "#1E293B", "#38BDF8", "#090D16"],
  ["gr-05", "Furniture City", "Steelcase, Herman Miller & mid-century walnut", "#7C4727", "#D4A373", "#2A9D8F", "#1A1410"],
  ["gr-06", "Fish Ladder Mist", "Sixth Street Park salmon run & river foam", "#2D6A4F", "#74C69D", "#E07A5F", "#10211B"],
  ["gr-07", "Buttercup Path", "Frederik Meijer Gardens & bronze horse", "#E9C46A", "#4A7C59", "#8D5B4C", "#18241C"],
  ["gr-08", "Heritage Hill", "Victorian brick, slate roofs & gaslight amber", "#8B3A3A", "#4A5568", "#F6AD55", "#1A1517"],
  ["gr-09", "Wealthy & Eastern", "Eastown street art, coffeehouses & brick", "#D97706", "#0D9488", "#FDE68A", "#1C1917"],
  ["gr-10", "Division Neon", "Heartside late-night diner & marquee glow", "#EC4899", "#06B6D4", "#FACC15", "#0F0A19"],
  ["gr-11", "Blandford Trail", "Nature center maples, creek mud & fern", "#3F6212", "#A3E635", "#92400E", "#141A0E"],
  ["gr-12", "ArtPrize Sept", "Street banners, gallery white & crowd teal", "#F97316", "#14B8A6", "#F8FAFC", "#18181B"],
  ["gr-13", "Medical Mile", "Glass hospital towers & sterile cyan", "#0284C7", "#E2E8F0", "#22D3EE", "#0B1724"],
  ["gr-14", "Founders Barrel", "Breakfast Stout espresso, oatmeal & gold", "#3E2723", "#D4AF37", "#EFEBE9", "#140D0B"],
  ["gr-15", "Amway Grand Gold", "Pantlind Ballroom leaf, velvet & marble", "#C59B27", "#7F1D1D", "#F3F4F6", "#17120E"],
  ["gr-16", "John Ball Canopy", "Zoo hillside pines, sandstone & macaw", "#15803D", "#D97706", "#EF4444", "#0F1F15"],
  ["gr-17", "131 Gridlock", "S-Curve brake lights, asphalt & sodium lamps", "#EF4444", "#F59E0B", "#64748B", "#121316"],
  ["gr-18", "Yesterdog Chili", "Eastown steamed bun, mustard & neon sign", "#FBBF24", "#991B1B", "#FEF3C7", "#1F1612"],
  ["gr-19", "Bissell Mint", "Walker-based vacuum turquoise & chrome", "#00A896", "#CBD5E1", "#F43F5E", "#0A191A"],
  ["gr-20", "Wolverine Boot", "Rockford/GR heritage full-grain leather & brass", "#854D0E", "#D97706", "#E7E5E4", "#1A1209"],
  ["gr-21", "Cascade Rapids", "Thornapple & Grand River whitewater slate", "#0369A1", "#94A3B8", "#E0F2FE", "#0B1520"],
  ["gr-22", "Rosa Parks Rink", "Downtown winter ice skate glow & amphitheater", "#38BDF8", "#F8FAFC", "#F43F5E", "#0C1322"],
  ["gr-23", "616 Underground", "Local GR hip-hop cypher, vinyl & gold chain", "#F59E0B", "#7C3AED", "#F8FAFC", "#0D0A14"],
  ["gr-24", "Bridge Street Run", "West Side tavern brick, amber neon & hop green", "#B45309", "#15803D", "#FDE047", "#17120D"],
  // Additions (same convention): cultural staples the master list did not cover.
  ["gr-25", "Silver Line", "The Rapid's Silver Line: brushed steel, route blue & stop-lamp white", "#94A3B8", "#1D4ED8", "#F8FAFC", "#0E131B"],
  ["gr-26", "Pier Lighthouse", "Grand Haven red pier light, harbor teal & sunset peach", "#DC2626", "#0E7490", "#FDBA74", "#0F1620"],
  ["gr-27", "Tulip Time", "Holland tulip rows, Delft blue & clog yellow", "#E11D48", "#1D4ED8", "#FDE047", "#150C14"],
  ["gr-28", "Paczki Day", "Hamtramck powdered sugar, plum filling & fryer gold", "#7E22CE", "#F8FAFC", "#F59E0B", "#150B1E"],
];
const MI: readonly Row[] = [
  ["mi-01", "Honolulu Silver", "Detroit Lions gridiron blue & metallic silver", "#0076B6", "#B0B7BC", "#FFFFFF", "#0A1926"],
  ["mi-02", "Spartan Gruff", "Michigan State forest green & clean white", "#18453B", "#FFFFFF", "#A3C1AD", "#091A16"],
  ["mi-03", "Big House Maize", "University of Michigan maize & deep blue", "#FFCB05", "#00274C", "#FFFFFF", "#051324"],
  ["mi-04", "Bad Boy Teal", "90s Detroit Pistons horse-head teal & red", "#008295", "#D50032", "#F59E0B", "#0D1B22"],
  ["mi-05", "Hockeytown Octo", "Detroit Red Wings crimson & octopus purple", "#CE1126", "#FFFFFF", "#7E22CE", "#17090C"],
  ["mi-06", "Olde English D", "Detroit Tigers midnight navy & blaze orange", "#0C2340", "#FA4616", "#FFFFFF", "#06101E"],
  ["mi-07", "Row the Boat", "Western Michigan (Kalamazoo) brown & gold", "#6C4023", "#B5A167", "#FFFFFF", "#1C110A"],
  ["mi-08", "Fire Up Maroon", "Central Michigan (Mt. Pleasant) maroon & gold", "#6A0032", "#FFC82E", "#FFFFFF", "#1D0510"],
  ["mi-09", "Sleeping Bear", "Lake Michigan golden dunes & turquoise surf", "#EAB308", "#06B6D4", "#FEF08A", "#0C1E26"],
  ["mi-10", "Mackinac Fudge", "Straits suspension green, limestone & cocoa", "#1E6B52", "#5C3A21", "#F1F5F9", "#0E1C17"],
  ["mi-11", "Superior Copper", "Upper Peninsula copper mines & deep lake", "#B87333", "#1D4ED8", "#93C5FD", "#0D1321"],
  ["mi-12", "Cherry Capital", "Traverse City tart cherry red & blossom pink", "#BE123C", "#FDA4AF", "#166534", "#1C0910"],
  ["mi-13", "Motor City Chrome", "Woodward Dream Cruise V8 steel & tailfin red", "#94A3B8", "#DC2626", "#38BDF8", "#0F172A"],
  ["mi-14", "Vernors Ginger", "Barrel-aged golden ale, gnome green & fizz", "#D97706", "#15803D", "#FEF9C3", "#1A140B"],
  ["mi-15", "Pictured Rocks", "Munising sandstone cliffs, mineral teal & pine", "#0D9488", "#EA580C", "#FDE68A", "#0C1A19"],
  ["mi-16", "Petoskey Stone", "Fossilized coral slate grey, wave foam & sand", "#64748B", "#CBD5E1", "#38BDF8", "#11161D"],
  ["mi-17", "Tahquamenon Tannin", "Root-beer amber falls, cedar bark & white mist", "#9A3412", "#F59E0B", "#F8FAFC", "#190E08"],
  ["mi-18", "8 Mile Wax", "Detroit hip-hop & Motown gold record vinyl", "#EAB308", "#1E293B", "#EF4444", "#09090B"],
  ["mi-19", "Lilac Festival", "Mackinac Island lilac purple, carriage-lantern brass & ferry white", "#9333EA", "#D4AF37", "#F5F3FF", "#140B1F"],
  ["mi-20", "Great Lakes Freighter", "Iron-ore hull red, pilothouse white & deep fresh water", "#B91C1C", "#F1F5F9", "#0EA5E9", "#0B1018"],
  ["mi-21", "Soo Locks", "Lock-gate rust, canal water & pass-through floodlight", "#78716C", "#0369A1", "#FDE68A", "#0E0F12"],
];
const MW: readonly Row[] = [
  ["mw-01", "Sandy's Penny", "Meijer retro red, cyan & horse-ride copper", "#DD1321", "#0072CE", "#D97706", "#180B0E"],
  ["mw-02", "Cereal City", "Battle Creek rooster red & corn gold", "#E11D48", "#FACC15", "#16A34A", "#1A0D10"],
  ["mw-03", "Carhartt Duck", "Dearborn heavyweight brown canvas & brass", "#9A6B32", "#D97706", "#E5E7EB", "#1C150D"],
  ["mw-04", "Faygo Pop", "Redpop crimson, Rock & Rye amber & fizz", "#E11D48", "#D97706", "#38BDF8", "#190C10"],
  ["mw-05", "Better Made", "Detroit yellow chip bag & crispy gold", "#FACC15", "#DC2626", "#FEF08A", "#1C180B"],
  ["mw-06", "Superman Scoop", "Michigan ice cream blue moon, lemon & cherry", "#0284C7", "#FACC15", "#E11D48", "#0C1926"],
  ["mw-07", "Coney Island", "Flint/Detroit chili sauce, mustard & white onion", "#991B1B", "#EAB308", "#F8FAFC", "#1A0E0C"],
  ["mw-08", "Euchre Bower", "Left/Right Jack spade black, heart red & felt", "#DC2626", "#15803D", "#F8FAFC", "#0E1712"],
  ["mw-09", "Lake Effect", "January whiteout blizzard, grey sky & ice blue", "#E2E8F0", "#64748B", "#7DD3FC", "#0F172A"],
  ["mw-10", "Ope Excuse Me", "Cozy plaid flannel, wool grey & warm cider", "#B91C1C", "#475569", "#F59E0B", "#171313"],
  ["mw-11", "Up North Cabin", "Knotty pine, birch bark & campfire ember", "#B45309", "#E7E5E4", "#F97316", "#1A120B"],
  ["mw-12", "Cornfield Dusk", "Late August harvest gold & violet twilight", "#EAB308", "#6D28D9", "#FB923C", "#140E24"],
  ["mw-13", "Culver's Butter", "Midwest custard royal blue & golden bun", "#0033A0", "#FBBF24", "#FFFFFF", "#07112B"],
  ["mw-14", "Menards Rebate", "Midwestern hardware forest green & price yellow", "#006837", "#FFF200", "#FFFFFF", "#081C11"],
  ["mw-15", "Rust Belt Rivet", "Oxidized iron beam, industrial teal & spark", "#B45309", "#0F766E", "#FDE047", "#141210"],
  ["mw-16", "Pothole Season", "Orange barrel cone, wet tar & neon vest", "#F97316", "#A3E635", "#94A3B8", "#121316"],
  ["mw-17", "Friday Fish Fry", "Golden walleye batter, tartar & lemon wedge", "#F59E0B", "#FEF3C7", "#16A34A", "#1A150B"],
  ["mw-18", "Barn Quilt", "Painted red barn wood, hex star blue & cream", "#991B1B", "#1D4ED8", "#FEF3C7", "#180E0E"],
  ["mw-19", "Cheese Curd Squeak", "Supper-club cheddar orange, brick-cellar red & fryer basket steel", "#F59E0B", "#B91C1C", "#FEF9C3", "#1A1209"],
  ["mw-20", "Hotdish Potluck", "Church-basement casserole tan, tater-tot gold & folding-table green", "#B08968", "#E9C46A", "#52796F", "#17130F"],
  ["mw-21", "Corn Maze Night", "Stalk-wall green, flashlight beam & October moon", "#4D7C0F", "#FDE68A", "#FB923C", "#0C1408"],
];
const US: readonly Row[] = [
  ["us-01", "Old Glory 76", "Classic American flag crimson, navy & star white", "#B22234", "#3C3B6E", "#FFFFFF", "#0D1021"],
  ["us-02", "Betsy Ross", "Heritage muted colonial red, indigo & parchment", "#9E2A2B", "#283845", "#F4EBD9", "#14181F"],
  ["us-03", "Route 66 Neon", "Vintage highway shield, desert teal & motel pink", "#0D9488", "#F43F5E", "#FDE047", "#111827"],
  ["us-04", "Apollo Saturn", "NASA mission white, booster black & gold foil", "#F8FAFC", "#F59E0B", "#EF4444", "#0B0F19"],
  ["us-05", "National Park", "NPS arrowhead forest, sandstone & sky", "#2D5A27", "#C28B59", "#38BDF8", "#111C12"],
  ["us-06", "Drive-In Double", "1950s turquoise Chevy, cherry milkshake & chrome", "#14B8A6", "#E11D48", "#E2E8F0", "#0D191E"],
  ["us-07", "Fourth of July", "Sparkler gold, mortar red & twilight cobalt", "#EF4444", "#2563EB", "#FACC15", "#090D1F"],
  ["us-08", "Blue Jeans & Brass", "Raw selvedge denim, copper rivet & stitch gold", "#1E3A8A", "#D97706", "#93C5FD", "#0B132B"],
  ["us-09", "Diner Jukebox", "Bubbling neon tubes, checkerboard & vinyl black", "#EC4899", "#EAB308", "#22D3EE", "#111111"],
  ["us-10", "Liberty Patina", "Oxidized copper green, torch flame & granite", "#2A9D8F", "#F97316", "#CBD5E1", "#0E1C1A"],
  ["us-11", "Gridiron Sunday", "Pigskin leather, turf green & yard-line white", "#15803D", "#854D0E", "#FFFFFF", "#0B1C11"],
  ["us-12", "County Fair", "Ferris wheel neon, cotton candy & hay bale", "#A855F7", "#F472B6", "#FACC15", "#150D21"],
  ["us-13", "Coney Boardwalk", "Saltwater taffy pink, ocean teal & carnival gold", "#F43F5E", "#06B6D4", "#FBBF24", "#0E1621"],
  ["us-14", "Varsity Letterman", "Wool chenille scarlet, cream sleeve & gold pin", "#B91C1C", "#FEF3C7", "#EAB308", "#1A0C0C"],
  ["us-15", "Heartland Vinyl", "Classic rock stereo VU amber, walnut & brushed steel", "#D97706", "#78350F", "#38BDF8", "#14100C"],
  ["us-16", "Porch Fireflies", "Mason-jar glow, screen-door green & July-night navy", "#A3E635", "#1E3A5F", "#FEF08A", "#080E18"],
  ["us-17", "Roadside Diner Pie", "Lattice-crust gold, berry filling & pie-case chrome", "#D4A24C", "#9D174D", "#E2E8F0", "#1A1210"],
];

const STARTERS = new Set(["gr-01", "gr-03", "mi-01", "us-01"]);
const TIER_OF: Record<string, PaletteTier> = {};
const tier = (t: PaletteTier, ids: string) => ids.split(" ").forEach((id) => (TIER_OF[id] = t));
tier("standard", "gr-01 gr-03 mi-01 us-01 gr-05 gr-07 gr-08 gr-09 gr-11 gr-12 gr-14 gr-17 gr-21 gr-24 mi-02 mi-03 mi-06 mi-07 mi-08 mi-10 mw-01 mw-02 mw-06 mw-07 mw-10 mw-11 mw-14 mw-17 mw-18 us-02 us-05 us-07 us-14");
tier("uncommon", "gr-02 gr-06 gr-16 gr-18 gr-20 gr-22 gr-25 gr-26 mi-04 mi-05 mi-09 mi-11 mi-12 mi-14 mi-16 mi-17 mi-21 mw-03 mw-04 mw-05 mw-08 mw-09 mw-13 mw-15 mw-16 mw-20 us-03 us-06 us-08 us-10 us-11 us-13 us-16 us-17");
tier("rare", "gr-04 gr-10 gr-13 gr-15 gr-19 gr-27 gr-28 mi-13 mi-15 mi-19 mi-20 mw-12 mw-19 mw-21 us-09 us-12 us-15");
tier("legendary", "gr-23 mi-18 us-04");

const GROUP_OF: Record<string, PaletteGroup> = { gr: "gr", mi: "mi", mw: "mw", us: "us" };
const REGION_OF: Record<PaletteGroup, string> = {
  gr: "Grand Rapids (616)",
  mi: "Michigan",
  mw: "Midwest",
  us: "Americana",
};

function hintsFor(group: PaletteGroup, name: string): PaletteUnlockHints {
  if (name === "Calder Plaza") {
    return { survivor616: "Clear Wave 10 in Downtown Calder Zone", queensAndKings: "Pawnford Crown Civic Prestige Tier 2" };
  }
  const s616: Record<PaletteGroup, string> = {
    gr: `Survive the waves in the ${name} part of town`,
    mi: `Win a run on a Michigan map to earn ${name}`,
    mw: `Finish a Midwest-flavored map to earn ${name}`,
    us: `Complete a run with a flag-day challenge to earn ${name}`,
  };
  const qk: Record<PaletteGroup, string> = {
    gr: `Win a Queens & Kings mini-game in a Grand Rapids kingdom to earn ${name}`,
    mi: `Reach a Michigan-banner prestige tier to earn ${name}`,
    mw: `Collect the matching Midwest banner to earn ${name}`,
    us: `Unlock the national banner set to earn ${name}`,
  };
  return { survivor616: s616[group], queensAndKings: qk[group] };
}

function build(row: Row): BasePaletteDef {
  const [id, name, reference, primary, secondary, accent, base] = row;
  const group = GROUP_OF[id.slice(0, 2)] as PaletteGroup;
  return {
    id,
    name,
    group,
    region: REGION_OF[group],
    reference,
    tokens: { primary, secondary, accent, base },
    // Derived, never hand-tuned: the glow is the primary lifted toward white, the HUD border is the primary, particles use the accent.
    fx: { glow: mixHex(primary, "#FFFFFF", 0.22), hudBorder: primary, particleTint: accent },
    tier: TIER_OF[id] ?? "uncommon",
    starter: STARTERS.has(id),
    unlock: hintsFor(group, name),
  };
}

export const BASE_PALETTES: readonly BasePaletteDef[] = [...GR, ...MI, ...MW, ...US].map(build);
export const BASE_PALETTES_BY_ID: Readonly<Record<string, BasePaletteDef>> = Object.fromEntries(BASE_PALETTES.map((p) => [p.id, p]));

// ------------------------------------------------------------- remix rules

const NIGHT_BASE = "#050507";
const FROST = "#BAE6FD";
const MAPLE = "#EA580C";

/** Fresh fx block for a token set, using the same derivation as the base themes. */
function fxFor(tokens: PaletteTokens): PaletteFx {
  return { glow: mixHex(tokens.primary, "#FFFFFF", 0.22), hudBorder: tokens.primary, particleTint: tokens.accent };
}

/**
 * _midnight (OLED night shift): swap primary and accent for combat/HUD contrast, drop the base to near black, and lift the
 * new accent's saturation by 12 points. If the accent is achromatic (white or grey) a literal swap would turn the whole body
 * white, so the primary stays and the secondary becomes the swap partner for the highlight instead.
 */
export function toMidnight(t: PaletteTokens): PaletteTokens {
  const achromatic = saturationOf(t.accent) < 0.12;
  if (achromatic) {
    return { primary: t.primary, secondary: t.accent, accent: boostSaturation(t.secondary, 0.12), base: NIGHT_BASE };
  }
  return { primary: t.accent, secondary: t.secondary, accent: boostSaturation(t.primary, 0.12), base: NIGHT_BASE };
}

/** _retro16 (cartridge): snap every token to RGB555 and lift the base a little so the contrast reads like a CRT. */
export function toRetro16(t: PaletteTokens): PaletteTokens {
  const base = mixHex(t.base, t.secondary, 0.07);
  return {
    primary: snapHex555(t.primary),
    secondary: snapHex555(t.secondary),
    accent: snapHex555(t.accent),
    base: snapHex555(base),
  };
}

/** _winter (January Lake Effect): pull the secondary toward frost and cool the primary and base slightly. */
export function toWinter(t: PaletteTokens): PaletteTokens {
  return {
    primary: mixHex(t.primary, FROST, 0.12),
    secondary: mixHex(t.secondary, FROST, 0.55),
    accent: t.accent,
    base: mixHex(t.base, "#0F172A", 0.25),
  };
}

/** _autumn (Up North Autumn): pull the secondary toward burnt maple and warm the primary slightly. */
export function toAutumn(t: PaletteTokens): PaletteTokens {
  return {
    primary: mixHex(t.primary, MAPLE, 0.1),
    secondary: mixHex(t.secondary, MAPLE, 0.55),
    accent: t.accent,
    base: mixHex(t.base, "#1A0F08", 0.25),
  };
}

const TRANSFORMS: Record<Exclude<PaletteVariant, "base">, (t: PaletteTokens) => PaletteTokens> = {
  midnight: toMidnight,
  retro16: toRetro16,
  winter: toWinter,
  autumn: toAutumn,
};
const VARIANT_LABEL: Record<PaletteVariant, string> = { base: "", midnight: "Midnight", retro16: "Retro16", winter: "Winter", autumn: "Autumn" };
const TIER_ORDER: readonly PaletteTier[] = ["standard", "uncommon", "rare", "legendary"];
const bump = (t: PaletteTier): PaletteTier => TIER_ORDER[Math.min(TIER_ORDER.length - 1, TIER_ORDER.indexOf(t) + 1)]!;

/** The id of a variant of a base theme: `gr-03`, `gr-03_midnight`, `gr-03_retro16`, `gr-03_winter`, `gr-03_autumn`. */
export function variantId(baseId: string, variant: PaletteVariant): string {
  return variant === "base" ? baseId : `${baseId}_${variant}`;
}

export function makeVariant(base: BasePaletteDef, variant: PaletteVariant): ThemePalette {
  if (variant === "base") return { ...base, baseId: base.id, variant };
  const tokens = TRANSFORMS[variant](base.tokens);
  return {
    ...base,
    id: variantId(base.id, variant),
    baseId: base.id,
    variant,
    name: `${base.name} ${VARIANT_LABEL[variant]}`,
    tokens,
    fx: fxFor(tokens),
    // Midnight is the premium remix: a step up in tier, and never a starter. The others keep the base tier.
    tier: variant === "midnight" ? bump(base.tier) : base.tier,
    starter: false,
  };
}

/** Every theme, one entry per (base, variant), in a stable order. */
export function expandPalettes(variants: readonly PaletteVariant[] = ALL_VARIANTS): ThemePalette[] {
  const out: ThemePalette[] = [];
  for (const base of BASE_PALETTES) for (const v of variants) out.push(makeVariant(base, v));
  return out;
}

/** Look up any theme id, including generated variants. Unknown ids return undefined. */
export function resolveTheme(id: string): ThemePalette | undefined {
  const [baseId, variant] = id.split("_") as [string, PaletteVariant | undefined];
  const base = BASE_PALETTES_BY_ID[baseId];
  if (!base) return undefined;
  if (!variant) return makeVariant(base, "base");
  return (ALL_VARIANTS as readonly string[]).includes(variant) && variant !== "base" ? makeVariant(base, variant) : undefined;
}

export type Season = "winter" | "autumn" | null;
/** Month 1..12 to a seasonal overlay: Sep-Nov autumn, Dec-Feb winter, otherwise none. Callers pass the month; no clock here. */
export function seasonForMonth(month: number): Season {
  if (month >= 9 && month <= 11) return "autumn";
  if (month === 12 || month <= 2) return "winter";
  return null;
}

/** The unlockable library: base + midnight + retro16 for every theme (the seasonal overlays are free on top). */
export function unlockableLibrary(): ThemePalette[] {
  return expandPalettes(UNLOCKABLE_VARIANTS);
}

// --------------------------------------------------------- game-side mapping

/**
 * A neutral 7-slot sprite palette (ink/body/bodyDark/accent/accentBright/skin/glow) from the 4 tokens, for games whose sprite
 * layer wants more slots. Deterministic; the game may override any slot afterwards.
 */
export interface SevenSlotPalette {
  ink: string;
  body: string;
  bodyDark: string;
  accent: string;
  accentBright: string;
  skin: string;
  glow: string;
}
export function toSevenSlot(theme: Pick<ThemePalette, "tokens" | "fx">): SevenSlotPalette {
  const { primary, secondary, accent, base } = theme.tokens;
  return {
    ink: base,
    body: primary,
    bodyDark: mixHex(primary, base, 0.55),
    accent: secondary,
    accentBright: accent,
    skin: mixHex("#D8B79A", primary, 0.1),
    glow: theme.fx.glow,
  };
}
