/**
 * Lore for the ladder of veterans, leaders and commanders in Sector 616. This is
 * data only: nothing in the game reads it yet, and it is kept so later work can
 * hang characters, areas and Tower sectors on one shared ladder. The prose lives
 * in `docs/LORE-masters.md`. Every figure here is provisional.
 *
 * Two axes. **Rank** (below) is how much authority someone holds. **Calling** is
 * what they lead: fighting and survival, but also politics, faith, business,
 * invention, genius, culture and tending the digital gardens. **Realm** says
 * whether they live in the city or in the digi realm (digibeings and all).
 *
 * To add someone, add a row to `MASTER_FIGURES`. `masterLore.test.ts` checks that
 * ids are unique, ranks and callings are valid, faction ids exist and no text uses
 * the banned word.
 */

export type MasterRankId = 'master' | 'sector-lead' | 'sector-mage' | 'sector-master' | 'master-divine' | 'digi-master';

export interface MasterRank {
  id: MasterRankId;
  title: string;
  /** 1 (lowest) to 6 (highest). Sector Lead, Mage and Master are three seats of one sector, so they sit close. */
  order: number;
  role: string;
  whereFound: string;
}

export const MASTER_RANKS: MasterRank[] = [
  { id: 'master', title: 'Master', order: 1, role: 'A veteran who mastered one craft. Not a commander, but people listen.', whereFound: 'Scattered everywhere: hideout rooms, back alleys, markets, the arena.' },
  { id: 'sector-lead', title: 'Sector Lead', order: 2, role: 'Governs one sector: keeps the lights on and the routes open.', whereFound: 'A sector hub or safehouse.' },
  { id: 'sector-mage', title: 'Sector Mage', order: 2, role: 'The sector master of Anima Resonance, the soul-spark arts. Knows the rules of the Grid.', whereFound: 'Near a sector relay or its deepest cache.' },
  { id: 'sector-master', title: 'Sector Master', order: 2, role: 'The sector martial commander: defense, patrols and who fights.', whereFound: 'A sector front line, gate or arena.' },
  { id: 'master-divine', title: 'Master Divine', order: 5, role: 'One of the rare few said to have broken the limit. Holds no sector.', whereFound: 'By deed, invitation or challenge; almost never by chance.' },
  { id: 'digi-master', title: 'Digi-Master', order: 6, role: 'Holds a whole DIGI-Tower sector. A post, not a person: it can be won, lost and passed on.', whereFound: 'The top floor of a Tower sector.' },
];

export const MASTER_RANK_BY_ID: Record<string, MasterRank> = Object.fromEntries(MASTER_RANKS.map((r) => [r.id, r]));

export type MasterCalling = 'war' | 'survival' | 'civic' | 'spiritual' | 'commerce' | 'invention' | 'genius' | 'culture' | 'garden';

export interface MasterCallingDef {
  id: MasterCalling;
  title: string;
  /** What leaders of this calling do, city side. */
  city: string;
  /** What the digi-realm version looks like. */
  digi: string;
}

/** Callings are orthogonal to rank: any rank can hold any calling. */
export const MASTER_CALLINGS: MasterCallingDef[] = [
  { id: 'war', title: 'War', city: 'Commanders, champions and veterans of the front line.', digi: 'Packet-wardens and Tower champions who hold a gate by being the gate.' },
  { id: 'survival', title: 'Survival', city: 'Scouts, handlers and wayfinders who keep people alive between fights.', digi: 'Cache-runners and cable-guides who know which routes are still real.' },
  { id: 'civic', title: 'Civic', city: 'Politicians, speakers and council-keepers who settle disputes without a fight.', digi: 'Digi mayors and quorum-clerks, elected by checksum and recalled by one.' },
  { id: 'spiritual', title: 'Spiritual', city: 'Chaplains, keepers of the evening hour, people who sit with the frightened.', digi: 'Oracles and cursors that people ask questions of in the dark.' },
  { id: 'commerce', title: 'Commerce', city: 'Brokers, tollkeepers and market-builders who keep goods and favors moving.', digi: 'Cycle-traders and cache-brokers who price anything, including bandwidth.' },
  { id: 'invention', title: 'Invention', city: 'Tinkers and engineers who fix the unfixable and build what is needed next.', digi: 'Architects and patch-smiths who rewrite the Grid\'s rules from the inside.' },
  { id: 'genius', title: 'Genius', city: 'Prodigies and savants who see the answer before the question finishes.', digi: 'Savants made of pure pattern, who solve things by being near them.' },
  { id: 'culture', title: 'Culture', city: 'Cypher champions, radio hosts and label heads: the people who keep 616 sounding like 616.', digi: 'Tape-spirits and jukebox keepers who keep the digi realm in rhythm.' },
  { id: 'garden', title: 'Garden', city: 'Roof-gardeners and window-box keepers who keep something green alive.', digi: 'Digibeings who water and spread digiflowers, one bloom at a time.' },
];

export const MASTER_CALLING_BY_ID: Record<string, MasterCallingDef> = Object.fromEntries(MASTER_CALLINGS.map((c) => [c.id, c]));

export type MasterRealm = 'city' | 'digi';

export interface MasterFigure {
  id: string;
  name: string;
  rank: MasterRankId;
  /** What they lead (see `MASTER_CALLINGS`). Every row names one. */
  calling: MasterCalling;
  /** Whether they live in the city or the digi realm. */
  realm: MasterRealm;
  /** A `FactionDef.id` from data/factions.ts, when the figure belongs to one. */
  faction?: string;
  /** Where they are found (a district, a room, a Tower sector). */
  place: string;
  /** One line in the game's voice. */
  blurb: string;
  /** For Digi-Masters, the Tower sector number (1 to 10). */
  towerSector?: number;
  provisional: true;
}

const fig = (
  id: string, name: string, rank: MasterRankId, calling: MasterCalling, realm: MasterRealm, place: string, blurb: string,
  extra: { faction?: string; towerSector?: number } = {},
): MasterFigure => ({ id, name, rank, calling, realm, place, blurb, ...extra, provisional: true });

export const MASTER_FIGURES: MasterFigure[] = [
  fig('nib', 'Master Nib', 'digi-master', 'survival', 'digi', 'Boot Sector', 'Small, green and certain that everything is already broken. Chews first, asks later.', { faction: 'data-goblins', towerSector: 1 }),
  fig('dropframe', 'Master Dropframe', 'digi-master', 'war', 'digi', 'Packet Alley', 'Skips a beat, and so does whatever it hits.', { faction: 'glitch-breach', towerSector: 2 }),
  fig('rootkit', 'Master Rootkit', 'digi-master', 'garden', 'digi', 'Canopy Stack', 'Grows where nobody planted it, and does not let go.', { faction: 'arbor-collective', towerSector: 3 }),
  fig('cabinet', 'Master Cabinet', 'digi-master', 'culture', 'digi', 'Neon Overflow', 'An arcade cabinet with opinions and a very long high-score list.', { faction: 'cabinet-rot', towerSector: 4 }),
  fig('overclock', 'Master Overclock', 'digi-master', 'invention', 'digi', 'Lev Spire', 'Runs hot on purpose. Dares you to keep up.', { faction: 'lev-syndicate', towerSector: 5 }),
  fig('hollow', 'Master Hollow', 'digi-master', 'survival', 'digi', 'Hollow Cache', 'Keeps the dark company and the fireflies in line.', { faction: 'firefly-wranglers', towerSector: 6 }),
  fig('reel', 'Master Reel', 'digi-master', 'culture', 'digi', 'Reel Vault', 'Calls every fight a take and every loss a cut.', { faction: 'reel-syndicate', towerSector: 7 }),
  fig('null', 'Master Null', 'digi-master', 'genius', 'digi', 'Null Basement', 'Where nothing is plugged in and everything runs.', { faction: 'null-sector', towerSector: 8 }),
  fig('prism', 'Master Prism', 'digi-master', 'spiritual', 'digi', 'Prism Core', 'Splits every attack into colors and every plan into three.', { faction: 'prism-choir', towerSector: 9 }),
  fig('apex', 'Grandmaster Apex', 'digi-master', 'war', 'digi', 'Apex Terminal', 'Holds the top of the Tower and has not been surprised in years.', { towerSector: 10 }),
  fig('old-tinsel', 'Old Tinsel', 'master', 'culture', 'city', 'the hideout main floor', 'A retired cypher champion who still corrects everyone\'s footwork.'),
  fig('quill', 'Quill', 'master', 'survival', 'city', 'the back alley', 'The best pet-handler nobody has heard of.'),
  fig('candlewick', 'Lead Candlewick', 'sector-lead', 'civic', 'city', 'Monroe Strip', 'Keeps a candle in a streetlight that never quite commits.'),
  fig('tollbooth', 'Lead Tollbooth', 'sector-lead', 'commerce', 'city', 'the back alley', 'Charges a small fee for everything and keeps meticulous books.'),
  fig('lattice', 'Mage Lattice', 'sector-mage', 'genius', 'city', 'the relay under Monroe', 'Hears the Grid humming and has stopped finding it unusual.'),
  fig('pennywhistle', 'Mage Pennywhistle', 'sector-mage', 'spiritual', 'city', 'Firefly Hollows', 'Talks to the fireflies, who talk back.', { faction: 'firefly-wranglers' }),
  fig('ironwood', 'Master Ironwood', 'sector-master', 'war', 'city', 'the work zones', 'A foreman who learned to wear armor and never took it off.', { faction: 'the-site-crew' }),
  fig('gantry', 'Master Gantry', 'sector-master', 'war', 'city', 'the Lev skyway', 'Commands the ground that watches the sky.', { faction: 'lev-syndicate' }),
  fig('orpheus', 'Divine Orpheus', 'master-divine', 'culture', 'city', 'unknown', 'Said to have left the city once and come back.'),
  fig('halcyon', 'Divine Halcyon', 'master-divine', 'war', 'city', 'unknown', 'Said to fight with the calm of someone who has already won.'),

  // Beyond war and survival: the people who run, comfort, trade, build and grow things.
  fig('ames', 'Speaker Ames', 'master', 'civic', 'city', 'the Monroe steps', 'Wins arguments by letting everyone finish, then summing up.'),
  fig('quorum', 'Lead Quorum', 'sector-lead', 'civic', 'city', 'the sector council hall', 'Chairs the meeting that never ends, and somehow everything gets done.'),
  fig('concord', 'Divine Concord', 'master-divine', 'civic', 'city', 'unknown', 'Said to have ended a standoff by sitting down in the middle of it.'),
  fig('vesper', 'Sister Vesper', 'master', 'spiritual', 'city', 'the old chapel', 'Keeps the evening hour, no matter who is still outside.'),
  fig('solace', 'Divine Solace', 'master-divine', 'spiritual', 'city', 'unknown', 'Said to have talked a Director out of a hunt, once, and not to mention it.'),
  fig('dime', 'Broker Dime', 'master', 'commerce', 'city', 'the night market', 'Can price anything, including you, and is usually right.'),
  fig('ledgerline', 'Lead Ledgerline', 'sector-lead', 'commerce', 'city', 'the first market', 'Built the sector\'s first market out of three tables and a promise.'),
  fig('gasket', 'Tinker Gasket', 'master', 'invention', 'city', 'the work zones', 'Fixes the unfixable and breaks the unbreakable, in that order.'),
  fig('auger', 'Divine Auger', 'master-divine', 'invention', 'city', 'unknown', 'Said to have built a door where there was no wall.'),
  fig('kit', 'Prodigy Kit', 'master', 'genius', 'city', 'the library annex', 'Age unknown. Solves it before you finish asking, then apologizes.'),
  fig('theorem', 'Mage Theorem', 'sector-mage', 'genius', 'city', 'the chalkboard cellar', 'Proves the rules of the Grid on a wall and erases them before anyone copies.'),
  fig('vinyl', 'Host Vinyl', 'master', 'culture', 'city', 'the radio hour', 'Knows every record and which ones to play when the street is quiet.'),
  fig('windowbox', 'Windowbox', 'master', 'garden', 'city', 'the rooftop beds', 'Keeps tomatoes alive three stories up, against the odds and the wind.'),

  // The digi realm has its own leaders of every kind.
  fig('packetwright', 'Mayor Packetwright', 'sector-lead', 'civic', 'digi', 'the Packet Alley assembly', 'Elected by a unanimous checksum. Recalled the same way, twice.'),
  fig('cursor', 'Oracle Cursor', 'master-divine', 'spiritual', 'digi', 'the dark between sectors', 'A blinking cursor people ask questions of. It answers with another question, usually the right one.'),
  fig('bitrate', 'Broker Bitrate', 'master', 'commerce', 'digi', 'the cache exchange', 'Trades in cycles, caches and favors, and never in the same currency twice.'),
  fig('patchwork', 'Architect Patchwork', 'master', 'invention', 'digi', 'the Lev Spire workshop', 'Rewrites the Grid\'s rules from the inside and leaves notes in the margins.'),
  fig('tessel', 'Savant Tessel', 'master-divine', 'genius', 'digi', 'everywhere at once', 'Pure pattern. Solves things by being near them.'),
  fig('tapehead', 'Tapehead', 'master', 'culture', 'digi', 'the Reel Vault', 'Keeps the digi realm in rhythm with one spinning reel and a lot of patience.'),
  fig('dewdrop', 'Master Dewdrop', 'master', 'garden', 'digi', 'wherever the light is thin', 'A small digibeing with a watering can made of light. Digiflowers bloom where it walks.'),
  fig('trellis', 'Lead Trellis', 'sector-lead', 'garden', 'digi', 'the Canopy Stack greenhouse', 'Governs the sector\'s gardens and does it very gently.', { faction: 'arbor-collective' }),
];

export const MASTER_FIGURE_BY_ID: Record<string, MasterFigure> = Object.fromEntries(MASTER_FIGURES.map((f) => [f.id, f]));

/** Gardens of the digi realm: lore only. Ambient digibeings can tend them later (see data/ambient.ts). */
export interface DigiFlower {
  id: string;
  name: string;
  /** Where it tends to bloom. */
  bloomsIn: string;
  look: string;
  note: string;
  provisional: true;
}

const flower = (id: string, name: string, bloomsIn: string, look: string, note: string): DigiFlower => ({ id, name, bloomsIn, look, note, provisional: true });

export const DIGI_FLOWERS: DigiFlower[] = [
  flower('bitbloom', 'Bitbloom', 'Boot Sector', 'Four square petals that flicker between two colors.', 'The first digiflower anyone saw. Blooms where a program crashed gently.'),
  flower('lagrose', 'Lagrose', 'Packet Alley', 'A rose that is always half a second behind its own stem.', 'Smells like a loading screen.'),
  flower('rootlily', 'Rootlily', 'Canopy Stack', 'Pale petals over roots that glow like cable.', 'Spreads on its own, which the Collective calls "agreeing with the soil."'),
  flower('neon-marigold', 'Neon Marigold', 'Neon Overflow', 'Hums in the key of the nearest cabinet.', 'Blooms best near a machine nobody has played in years.'),
  flower('glowcap', 'Glowcap', 'Hollow Cache', 'A small lantern on a stem. Fireflies nap in it.', 'Never wilts in the dark, only in a spotlight.'),
  flower('prism-peony', 'Prism Peony', 'Prism Core', 'Splits sunlight into three flowers and a rumor.', 'Said to open only for someone telling the truth.'),
  flower('nullweed', 'Nullweed', 'Null Basement', 'A flower-shaped gap in the air. The bees circle it politely.', 'The one that blooms where nothing else will.'),
];

/** Gardening digibeings: ambient wanderers that can be spotted watering and spreading digiflowers. */
export interface DigiGardener {
  id: string;
  name: string;
  blurb: string;
  tends: string[];
  provisional: true;
}

export const DIGI_GARDENERS: DigiGardener[] = [
  { id: 'dewdrop-sprite', name: 'Dewdrop Sprite', blurb: 'A palm-sized digibeing with a watering can made of light. Waters everything twice.', tends: ['bitbloom', 'lagrose'], provisional: true },
  { id: 'pollen-packet', name: 'Pollen Packet', blurb: 'A drifting bundle of data that sprinkles seeds into unlikely cracks.', tends: ['rootlily', 'glowcap'], provisional: true },
  { id: 'seedling-daemon', name: 'Seedling Daemon', blurb: 'A background process that wanders sector to sector planting one flower, then leaving.', tends: ['neon-marigold', 'prism-peony', 'nullweed'], provisional: true },
];
