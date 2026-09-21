/**
 * Patch notes, written the way a small dev team actually talks to its
 * players -- plain, a little informal, signed by the studio. Shown as a big
 * popup (see `ui/UpdatePopup.tsx`) the first time a player loads the game
 * after `CURRENT_VERSION` changes, and as a running history in the
 * Archive's "Updates" chapter.
 *
 * Versions are plain `MAJOR.MINOR.PATCH` strings, oldest entry first. Bump
 * MINOR for a real update (new content/systems), PATCH for a hotfix
 * (bug-only), and just append a new entry -- `CURRENT_VERSION` and the
 * "Update #" counter both derive from this array, nothing else to update.
 */
export const STUDIO_NAME = 'Kinetic Souls';

export interface ChangelogEntry {
  version: string;
  date: string;
  kind: 'update' | 'hotfix';
  title: string;
  body: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-09-17',
    kind: 'update',
    title: 'Faster Loads, New Face on the Block',
    body: [
      'Split the app into smaller chunks so a fresh visit loads noticeably faster.',
      'Antler Fawn joins the River Antler Court roster.',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-09-17',
    kind: 'hotfix',
    title: "Fixed a Dungeon Exit That Wasn't",
    body: [
      "Squashed a bug where an endless-mode dungeon exit could spawn somewhere you could never actually reach -- if you've ever gotten permanently stuck in a dungeon, this was why.",
      'Added a Factions lore tab so you can read up on who you\'re actually fighting.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-18',
    kind: 'update',
    title: 'Factions Move In With the Bestiary',
    body: [
      'Moved the Factions lore pages out of the Archive and into the Bestiary, right next to the Threats list, with a toggle to flip between them. Made more sense living together.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-18',
    kind: 'update',
    title: 'Your Level Now Actually Means Something',
    body: [
      "Added a persistent Player Level that tracks everything you've ever done, forever. No cap -- it just gets slower to climb the higher you go.",
      'New "Stats" page in the Archive pulls every lifetime number (kills, runs, best survival, endless records) into one place instead of scattering them across menus.',
      'Leveling up now gets its own animated callout on the after-action report.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-09-18',
    kind: 'update',
    title: 'Every Operative Gets Their Own Story',
    body: [
      'Characters now level up individually. Play Shade a lot, Shade gets stronger -- permanently. Small combat bonus, capped, so it stays a nice perk and not a new meta.',
      'Rookie -> Veteran -> Elite -> Legend -> Mythic rank titles, shown right on the roster.',
      'New "Mastery" page in the Archive shows how every operative in the roster stacks up.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-09-18',
    kind: 'update',
    title: 'Patch Notes, From Us to You',
    body: [
      "You're reading it. Added real patch notes: a big popup when we ship something new, a running Updates page in the Archive, and -- because every good main menu needs one -- random little blurbs from us up on the Hideout screen.",
      `-- ${STUDIO_NAME}`,
    ],
  },
  {
    version: '0.6.0',
    date: '2026-09-21',
    kind: 'update',
    title: 'Looks, LokPets, and a Hideout That Makes Sense',
    body: [
      'Looks & LokPets now stays saved and launches from the hideout instead of interrupting every match.',
      'Your selected companion stays at your side, or rests in the Handheld DigiScope when its charge is empty.',
      'Standard, Bonus, 2x, and Infinite maps now have their own tabs. Infinite Worlds remain truly endless.',
      'The Sound Booth now owns Studio and Soundtrack; the Alley Annex owns the Quartermaster and Relic Workshop; Archives and Bestiary live in the Back Room.',
      'First Night starts minimized, mobile readiness is easier to read, and every menu page returns to the top with a persistent mobile Back button.',
      'Loot controls no longer sit on top of level-up choices, Live Mode always exposes Pause and Leave, and UI transparency can be tuned globally or by HUD, menu, and popup.',
      'Legendary companions now occupy their own selection tier, Lit Corner activities are marked experimental, and older radio wording has been replaced.',
      'The Sound Booth player keeps previous, play, and next up front, with shuffle, repeat, and volume tucked into optional advanced controls.',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[CHANGELOG.length - 1]!.version;

export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isVersionNewer(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

/** Entries strictly newer than `version`, oldest-of-the-unseen first. */
export function changelogEntriesSince(version: string): ChangelogEntry[] {
  return CHANGELOG.filter((entry) => isVersionNewer(entry.version, version));
}

/** 1-based "Update #N" position in ship order. */
export function updateNumber(entry: ChangelogEntry): number {
  return CHANGELOG.indexOf(entry) + 1;
}
