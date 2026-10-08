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
  {
    version: '0.7.0',
    date: '2026-09-21',
    kind: 'update',
    title: 'Your Frame, Your Soundtrack',
    body: [
      'LokPets and playable characters now each have their own saved portrait frame: Square, Soft, or Round. Interface borders remain a separate choice.',
      'A persistent Soundtrack button now starts a random unlocked song from anywhere in the game, and skips the current track when another unlocked option exists.',
      'All frame choices live in Looks & LokPets and are ready for future collectible frames, animation effects, and rarity styles.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-09-27',
    kind: 'update',
    title: 'The Defector Reaches the Spire',
    body: [
      'Vector Lev joins the playable roster with the Lev Expansion nova and Singularity Collapse ultimate.',
      'Lev Overlord Prime now closes the Lev Syndicate Spire as its giant gravity-frame commander.',
      'Level Vector Lev once to earn the Singularity Defector achievement.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-28',
    kind: 'update',
    title: 'Hazards Get Their Own Identity',
    body: [
      'Ground hazards, novas, and auras now use weapon-specific shapes instead of sharing the same circle or center flash.',
      'Hazard weapons appear less often, and—with Emberback as the early exception—join normal level-up loot after their associated character is unlocked.',
      'Only the associated character ignores a hazard by default. Let Me Hold This still grants universal hazard protection.',
      'Hook Ghost now unlocks through Neon Overflow, giving the Sixth Ward Cypher a cleaner two-level progression route.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-09-28',
    kind: 'update',
    title: 'The Horde Hits Seven Digits',
    body: [
      'Million Horde joins the run modifiers with a crowd that can climb into the millions without allocating millions of individual enemies.',
      'Nearby enemies stay fully interactive while an adaptive crowd layer scales for compatibility phones, modern phones, and desktop browsers.',
      'Bonus Maps now includes the authored Odd Routes that were previously hidden from the category.',
      'Map category tabs now scroll inside their own row on narrow screens instead of stretching the page.',
    ],
  },
  {
    version: '0.10.1',
    date: '2026-10-04',
    kind: 'update',
    title: 'The Underground Update',
    body: [
      'Digital Russel (Cluck-616) and Barnaby Bit-Herder join the roster, with the Bionic Cluck Protocol run modifier turning fallen hostiles into egg-laying allies.',
      'Firefly Hollows Extreme arrives with Firefly Miners, Evokers, Spikers, Cannons and the dual-cannon Red Firefly duelist, plus veteran enemy variants and mimic chests.',
      'The Workshop gains a Relic Forge, light-source key items (miner helmet, firefly jar, phosphor crown) and the Bag o\u2019 Water.',
      'The Card Shop returns with sealed pack storage, single-card purchases, duplicate recycling and a card matrix chart; the Lock Deck binder shows card classes and combat variables.',
      'Dust Mite Rancher, Sector 616 Chronicles lore popup, 4\u00d7 Extreme map tab and a much larger LokPet roster and battle script round out the update.',
    ],
  },
  {
    version: '0.10.2',
    date: '2026-10-04',
    kind: 'update',
    title: 'Card Style Choice',
    body: [
      'Lok Card Shop and Lock Deck cards now have a Card Style picker: Classic keeps the original foil-framed binder look and stays the default, New is the streamlined look from the Underground Update, and Dynamic 3D adds tilt and holographic foil.',
    ],
  },
  {
    version: '0.10.3',
    date: '2026-10-04',
    kind: 'hotfix',
    title: 'Soundtrack Wake-Up',
    body: [
      'The title-screen soundtrack now starts on your first tap or key press, including on phones and tablets where the old retry could not satisfy the browser. A new Start on first tap switch in the Music panel turns it off.',
      'Six new hideout one-liners and a hidden title-screen surprise for anyone who remembers the old code.',
    ],
  },
  {
    version: '0.10.4',
    date: '2026-10-04',
    kind: 'hotfix',
    title: 'Motion Override',
    body: [
      'When a phone or computer asks apps to reduce motion, the title live feed, hideout rain and parallax, the walking operative and random visitors now stay still. The title screen shows a tap-to-fix notice, and Settings has an Always animate switch that keeps everything moving.',
    ],
  },
  {
    version: '0.10.5',
    date: '2026-10-04',
    kind: 'update',
    title: 'Studio 28 Filters',
    body: [
      'Studio 28 can now filter the weapon list by weapon type, by active or banned status, and by search, with Activate shown and Ban shown buttons that always leave at least one weapon lit.',
    ],
  },
  {
    version: '0.10.6',
    date: '2026-10-04',
    kind: 'update',
    title: 'Clearer Fights',
    body: [
      'Every move in the LokPet arena now says Strong, Normal, Weak or Support against the opponent in front of you, and status effects show whether they help or hurt and how many turns are left.',
      'New optional quick fights: turn on Quick fights in Settings and travel encounters play out with your lead LokPet, three moves, a round limit of eight, and the opponent\'s next move shown before you pick. The classic card-throw popup stays the default.',
    ],
  },
  {
    version: '0.10.7',
    date: '2026-10-04',
    kind: 'update',
    title: 'Travel Fight Styles',
    body: [
      'Settings has a new Travel fight style picker. Classic is still the original card-throw popup and is still the default.',
      'Quick runs the fight on your lead LokPet with three moves. Duo puts your operator beside your LokPet: every round you pick a LokPet move and an operator assist (a punch, a Battle Deck card, or a one-time cover). Arena is the full side-by-side battle with every move, finishers and Cheer.',
      'All three new styles adapt to your screen: phones get a stacked layout, bigger screens get stat panels either side and a running battle log.',
    ],
  },
  {
    version: '0.10.8',
    date: '2026-10-04',
    kind: 'update',
    title: 'The Operator Forge',
    body: [
      'A hidden workshop for designing new operators. Tap the Save data label in Settings five times to find it.',
      'Build one by hand or generate them: ten species from human to dragonkin, nine body builds with height and width sliders, nine color schemes with a wide skin tone range, and around 190 hairstyles, hats, eyes, outfits, accessories and held items, each with its own color.',
      'Forged operators borrow the stats, weapon and ultimate of any kit you have unlocked and get their own name, bio and look. They are added to your roster alongside everyone else; every existing operator stays exactly as it was.',
      'Operators can be shared as a short code, and the Forge can make five random ones at a time.',
    ],
  },
  {
    version: '0.10.9',
    date: '2026-10-04',
    kind: 'update',
    title: 'End Game: Victory Lap',
    body: [
      'Clear every standard map once and Settings gains a second page, End game, that slides in beside Standard. Before then it does not appear at all.',
      'Everything extra is optional and starts switched off: the Operator Forge, a zoom viewer that opens any operator at full size, 21 new faction races for the Forge, a holographic foil on your selected operator, and a glow aura on roster tiles.',
      'Five custom operator slots, each earned a different way: clear every map, defeat 20,000 enemies, rescue 15 allies, find 18 discoveries, win 25 LokPet battles. A custom operator is a modified copy of a premade operator and never replaces one.',
      'The Forge also gained about 30 more looks (antlers, film reels, mining lamps, hi-vis vests and more). The five-tap secret is gone; anyone who found the Forge before keeps it.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-10-04',
    kind: 'update',
    title: 'Bond and Growth',
    body: [
      'LokPets now grow from everything you do: finishing runs, winning travel fights, treats and arena battles all earn XP, and your starter partner always takes the biggest share. XP now adds up between battles instead of being lost.',
      'Pets also build a bond with you: Stranger, Familiar, Friend, Partner, Soulbound. It only goes up, with a daily limit so it rewards coming back. Each rank opens a name slot, and your starter partner gets its call name from the very first night (naming it is optional).',
      'Open the pencil on a pet in Run Setup to see all five names: call name, battle name (used in the arena), what it calls you, an epithet and a true name. Run Setup also lets Collector characters bring a full team.',
      'After a run a small Growth Recap shows each pet\'s XP, level and bond. Achievements can be filtered by category, there are six new LokPet achievements, and you get a toast when you earn one.',
      'Fixes: a status effect that dropped a pet to 0 HP could stall a fight; pets now use one evolution rule everywhere; the league blurb counts all eight tiers.',
    ],
  },
  {
    version: '0.11.1',
    date: '2026-10-04',
    kind: 'update',
    title: 'Hideout Companions',
    body: [
      'Your LokPets now walk the Hideout strip with your operator. Your starter partner is always there, and the pets you picked for a run can tag along. They trail behind, sit, sniff or nap when the operator stops, and splash in the puddles when it rains.',
      'They vibe to music: play a track and they bounce on the beat and throw sparks on the downbeat. Tap a pet to pet it (the first pet each day builds bond), tap twice for a spin trick, or tap the ground and they trot over.',
      'Every so often a small event plays: a morning stretch, a dance break, a puddle stomp, a nap in the heat, a shy peek, and a very odd visitor around 3 a.m. Each event shows one line in the corner and gives a little XP and bond. Some only happen at higher bond ranks.',
      'Settings: choose which pets walk the strip (all, partner only, off) and how often events play (normal, rarely, off). Reduced motion keeps a still scene.',
    ],
  },
  {
    version: '0.11.2',
    date: '2026-10-04',
    kind: 'update',
    title: 'Evolution Paths',
    body: [
      'Once a LokPet reaches its second form you can pick an evolution path for it, from the new Evolution section of its profile in the Companion Kennel (it starts collapsed, and a small dot says a path is ready). Each starter has two paths with their own names and looks, such as Lil Llamà\'s Heart path (halo, softer glow) or Street path (armor plates, horns). Every other LokPet gets a path for its family, so the whole roster has a second way to grow.',
      'Paths are optional. Skip them and your pet evolves exactly as before. Some paths ask for a bond rank or a few battle wins, and the panel shows what is missing. Picking plays a short charge-up and reveal that shows what changed (it skips straight to the result with reduced motion), and you can undo a pick for free for 24 hours.',
      'A chosen path shows everywhere the pet appears: the run, the arena, Run Setup and the Hideout strip. Nothing changes for existing pets until you choose, and stats still follow the form, not the path.',
    ],
  },
  {
    version: '0.11.3',
    date: '2026-10-04',
    kind: 'update',
    title: 'Language Support',
    body: [
      'The title screen, the hideout rooms and part of Settings can now be translated. Translations are made automatically, so some wording will be off, and anything not translated yet stays in English.',
      'The game follows your browser or phone language by default, and switches on its own if you change it. A Language option at the top of Settings lets you pin any language, or go back to Match my device.',
    ],
  },
  {
    version: '0.11.4',
    date: '2026-10-05',
    kind: 'update',
    title: 'Your LokDex Follows You',
    body: [
      'Sign in and your cards and LokPets now show up in the LokDex on the GSix website, next to the ones from Spend It All. It is the same account, so signing in on the site or in either game is enough.',
      'Only a short summary is shared: which cards you own and each LokPet\'s name, level and rarity. Your save and run progress are not part of it. You can hide your LokDex from your public profile any time from the Profile page on the site.',
    ],
  },
  {
    version: '0.11.5',
    date: '2026-10-05',
    kind: 'update',
    title: 'Universe Hookups',
    body: [
      'The Universe chapter now shows your LokTokens, cloud save state and collection side by side.',
      'Claiming an achievement or trading a card with another LOK game can now earn LokTokens when you are signed in.',
    ],
  },
  {
    version: '0.11.6',
    date: '2026-10-05',
    kind: 'update',
    title: 'Universe Binder',
    body: [
      'The Universe chapter now holds a binder of every card from every LOK game. Browse them all together or one game at a time, and build decks that follow your account.',
      'Cards from other games are drawn from their own models. Palettes in the Paint Gallery are now bought with LokTokens, so you need to sign in to buy new ones. Palettes you already own stay yours.',
    ],
  },
  {
    version: '0.11.7',
    date: '2026-10-05',
    kind: 'update',
    title: 'Lokifed Everywhere',
    body: [
      'The Lokifed \u2014 Take 1 soundtrack is now a built-in part of the Lok network. The same album can be played from the GSix site and any other Lok app with the new Lok Music player: play, pause, skip, seek, shuffle, repeat, volume, and pick any song from the list.',
      'Your progress travels with you. While you are signed in, finishing objectives in the game opens the same songs on the website, so the more you play the more of the album you can listen to there. In the game itself, tracks still unlock exactly as before.',
      'No sign-in? Once an hour, at a random minute, one locked song opens on the website for an hour. Play it while it is open and it is yours for good, and the player tells you when one is on air.',
      'The player costs nothing to load: it stays closed and downloads no music until someone presses play. Files you add from your own device never leave that device.',
    ],
  },
  {
    version: '0.11.8',
    date: '2026-10-05',
    kind: 'update',
    title: 'Where the Songs Come From',
    body: [
      'On the GSix website, the music player now says which game each song is from, with a link to play it, and under every locked song it tells you exactly how to unlock it, such as completing a number of run objectives in 616 Survivor.',
      'The Lokifed \u2014 Take 1 songs are now credited to Cante-Digital.',
    ],
  },
  {
    version: '0.11.9',
    date: '2026-10-05',
    kind: 'hotfix',
    title: 'Sign In Inside The Arcade',
    body: [
      'Continue with Google and Continue with Apple now work when you play on the GSix website. The website\u2019s game player is a window inside a page, and Google refuses to show its sign-in there \u2014 the error you saw. The game now opens sign-in on the full page instead, then brings you back signed in.',
      'Sign-in also returns you to the exact address you started from, rather than the site\u2019s default page.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-05',
    kind: 'update',
    title: 'The Digi-Verse On The Web',
    body: [
      'The 616 Survivor page on the GSix website now shows the Digi-Verse Archives in the game\u2019s original deep red, with an option to switch back to the classic colors.',
      'A new bar on that page jumps straight to the Archives, the Updates and each lore chapter. The Updates list there is the same patch notes you see in the game, in blue, and it keeps itself current.',
    ],
  },
  {
    version: '0.12.1',
    date: '2026-10-05',
    kind: 'update',
    title: 'The Block Stays Alive',
    body: [
      'Endless buildings now let you walk in without resetting the street fight. Choose Classic in Settings if you prefer the separate prefab rooms.',
      'One building per block has a marked, one-time supply find. Floors and soft lighting fit the place, and a lit strip helps you find the doorway.',
      'The title live feed gets a first-load preview. On later loads, a device request for reduced motion pauses it and shows a small glowing notice. Always animate overrides the pause.',
    ],
  },
  {
    version: '0.12.2',
    date: '2026-10-06',
    kind: 'update',
    title: 'Demo Day On The Web',
    body: [
      'Demo Day lets The Foreman play on top of any web page. Start it from the Demo Day page on the GSix website, and the page\u2019s text, pictures and buttons become things to smash. Press Esc and everything goes back exactly as it was.',
      'It is early access: desktop browsers and keyboard only, and it skips sign-in, payment, banking, health and government pages. When you stop, a card shows how much of the page you took down, with a link to save and share it.',
    ],
  },
  {
    version: '0.12.3',
    date: '2026-10-06',
    kind: 'update',
    title: 'Experimental Map Playlist',
    body: [
      'The map picker now has an Experimental overview for bonus, 2×, 4×, classic, infinite, and custom routes. The original map filters are still there.',
      'Every map card now shows its type, including routes you have not unlocked yet.',
    ],
  },
  {
    version: '0.12.4',
    date: '2026-10-04',
    kind: 'update',
    title: 'The Crew After Hours',
    body: [
      'Eleven new crew jobs widen the hideout rotation. Rapid Shelter now has working assignments of its own, and every rescued ally has more than one reachable job.',
      'Rescue crew to earn Ember Guard and Moon Runner colors for every fighter, plus three animated hideout scene looks. The original scene and original fighter colors stay available.',
      'Three new hats join the loot-token shop. Watch for a tiny feudal age, a garlic orbit, and one more run before dawn.',
    ],
  },
  {
    version: '0.12.5',
    date: '2026-10-05',
    kind: 'hotfix',
    title: 'Back To The Arcade',
    body: [
      'Signing in from the game on the GSix website now brings you straight back to the arcade page, signed in and ready to play, instead of leaving you on the standalone game page.',
    ],
  },
  {
    version: '0.12.6',
    date: '2026-10-06',
    kind: 'update',
    title: 'Demo Day Breaks Through',
    body: [
      'Smashing a page now tears real holes in it: the streets of 616 show through wherever text, pictures and buttons were destroyed, with a hard pixel edge and scorch marks around big blasts. The page underneath is never touched, so quitting puts everything back instantly.',
      'Breaking things now feels like it: hit flashes, cracks that spread across damaged blocks, pieces that dissolve away and fly off in the page\u2019s own colours, climbing damage numbers, a combo counter, heavy-hit freezes, screen shake, a soft glow around blasts and sound effects (M mutes).',
      'Demo Day is now a survival game: waves of glitch enemies arrive in tiers while you tear the page down, a boss shows up as the page falls, and clearing 70% of the page and the boss completes the level. You can dash (Shift, or double-tap a direction) through enemies and text with a brief invulnerable window, pause with Esc or P (it also pauses when you switch tabs), pick level-up upgrades with 1, 2 or 3, and open loot boxes for prizes. Settings include Zen mode with no enemies, game speed, screen shake and more.',
      'Everything you break pays out for what it was: headings give big XP, links some, buttons and inputs can heal, large images are loot crates, and ad frames set off a street sweep. Footers, navigation and headings are armored (hazard tape along the top), article text is soft, and the deeper down the page you go the tougher the enemies get; dense text brings more of them. The level is named after the page, and your report link now breaks down what came down.',
      'Pick any of the 69 survivors before you start (or switch from the pause menu): a searchable roster with portraits, every character playable. Zero Day\u2019s freeze-and-throw and Artiste\u2019s draw-dodge work on the F key, since there is no mouse to aim with.',
      'The Foreman moves about 30% faster and the game now runs on a chunkier pixel grid that stays locked to the page as it scrolls. While you play, clicks and the mouse wheel no longer reach the page, so a destroyed link cannot be followed by accident.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-06',
    kind: 'update',
    title: 'Forge and Settings Tune-Up',
    body: [
      'Dev Mode now shows all five usable Forge slots inside the workshop, matching the save rules.',
      'Save downloads now include your forged operators alongside game progress. Older progress-only files still import without erasing operators already on this device.',
      'Settings has a section finder and music volume control. The Forge keeps a compact preview visible on phones and adds undo, redo, duplicate, and a warning before replacing unsaved work.',
    ],
  },
  {
    version: '0.13.1',
    date: '2026-10-06',
    kind: 'update',
    title: 'Faster Forge Starts',
    body: [
      'The Forge now has one-tap Street, Tech, Mystic, and Wild starting designs, plus reset buttons for body, palette, and each feature section.',
      'Settings has a fullscreen control for browsers that support it. Esc still leaves fullscreen normally.',
    ],
  },
  {
    version: '0.13.2',
    date: '2026-10-06',
    kind: 'update',
    title: 'The GRPD Armory Opens',
    body: [
      'The GRPD Station now holds an evidence archive of thirty weapon designs, each with its own pixel model. Sealed designs stay out of runs.',
      'Crossing Baton, Rivet Driver, and Deck Sling are the first field prototypes. Earn an evidence seal every 1,000 lifetime kills, fabricate a prototype, then switch it on before it can appear in future runs.',
      'Every 1,000 kills adds 0.01 relative offer weight to active GRPD weapons. You can spend evidence seals on individual 2×, 3×, 4×, and 5× offer tiers.',
    ],
  },
  {
    version: '0.13.3',
    date: '2026-10-06',
    kind: 'update',
    title: 'Armory Spawn Control',
    body: [
      'The GRPD Armory now has an automatic kill increase switch. Turn it off to remove the +0.01 offer weight gained every 1,000 lifetime kills while keeping your purchased tiers.',
      'Turn it back on whenever you want the bonus from your current lifetime kill total.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-10-06',
    kind: 'update',
    title: 'The Frogsters and the Armory Keeper',
    body: [
      'Jeremey Frogster now welcomes survivors to the Circuit Frog Ranch, while his twin Jeramy runs the boards at Gorilla Studios. Both have their own animated character models and a shared story in the Digi-Verse Archives.',
      'The GRPD Armory has a Luvitnot keeper: an Eclipse-born water and spirit being in a white-and-gold protective suit with a glass helmet.',
      'Ask the keeper to hum-shift the Armory between the GRPD Station and the hideout. The entrance follows its saved location.',
    ],
  },
  {
    version: '0.14.1',
    date: '2026-10-06',
    kind: 'hotfix',
    title: 'Popups Stay on Screen',
    body: [
      'Fixed popups (card details in The Neon Sleeve, pack odds, the bestiary and more) opening off-center, forcing you to scroll to reach them. On desktop browsers this hit anyone using an animated theme (Midnight Reliquary, Mirror Carnival, Aurora Transit, Chrome Vespers, Paper Lantern): the popup opened far below the screen.',
      'Popups now size to the visible screen on phones, so the browser toolbar no longer clips them. A tall popup scrolls inside itself, and its close button stays reachable.',
      'The floating Back button no longer sits on top of an open popup.',
    ],
  },
  {
    version: '0.14.2',
    date: '2026-10-06',
    kind: 'hotfix',
    title: 'Studio Takes Stop Hogging Memory',
    body: [
      'Fixed a memory leak in the Studio: deleting a recorded mic take (or any clip) left its audio loaded in memory for the rest of the session. A clip\u2019s audio is now freed once nothing else uses it.',
      'Clips that share the same audio, and clips still waiting in your library, keep playing normally.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-10-06',
    kind: 'update',
    title: 'Walk the Hideout',
    body: [
      'You can walk your operator around the hideout now. Tap the ground, or use the arrow keys or A and D, and walk up to the things in each room to use them.',
      'The bell cord, the Relay Crate, the Static Jar, the Beacon Lamp and a few others hand out small finds once a day. The stoop cat and the old telescope can start something, too.',
      'LokPets can do more than get petted. Scratch, fetch, boogie, snack break, nap together, and go on a sniff hunt. Every pet likes different things, and a closer bond opens up more of them and makes rare finds a little more likely.',
      'Little choice events turn up around the hideout and when you move between rooms. Pick what to do and see how it goes. A few rare surprises are hiding in there.',
      'It is all capped per day, and you can switch each part off in Settings under Hideout.',
    ],
  },
  {
    version: '0.15.1',
    date: '2026-10-06',
    kind: 'hotfix',
    title: 'Hideout and Travel, Armory Found',
    body: [
      'The GRPD Armory was stuck behind GRPD Station, which only opens after clearing Division St. Until the station is found, the Luvitnot keeper now holds the Armory entrance on the Sanctum main floor.',
      'The room list is split in two. Hideout rooms (the Sanctum, the Perch, the Cellar, the Alley Annex, the Back Room and the Sound Booth) are safe. Travel rooms (The Neon Sleeve, Studio 28, GRPD Station, the Vault and Rapid Shelter) are out in the city and are marked with an Ambush risk badge.',
      'You can only be ambushed when you travel. Studio 28, the Vault and Rapid Shelter now count, and the Perch, Cellar and Alley Annex no longer do. The Travel setting still switches ambushes off.',
    ],
  },
  {
    version: '0.15.2',
    date: '2026-10-06',
    kind: 'hotfix',
    title: 'Your LokPet Travels With You',
    body: [
      'Your lead LokPet now comes along on every travel ambush. It steps in beside you with the same entrance it got on your first night in the hideout.',
      'In Duo and Arena fights you bring your whole selected team and can switch LokPets mid-fight. A switch costs your turn, and the next LokPet steps in with the entrance, including after one is knocked out.',
      'Arena combat is a travel fight style you can pick in Settings. The classic popup is still the default, and its Send button now replays the entrance.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-10-08',
    kind: 'update',
    title: 'Build a Beat in Gorilla Studios',
    body: [
      'Studio now keeps multiple local projects. Create, open, rename, duplicate, and delete them from the project browser; undo and redo edits as you work.',
      'The new 16-step drum sequencer has three original kits, swing, velocity, custom sample pads, and patterns you can place on the song timeline.',
      'Audio clips gain waveforms, zoom, trim, split, duplication, gain, and fades. Melodies live in movable MIDI clips with note length, velocity, and quantize controls.',
      'Add EQ or compression to tracks, watch input and master levels, and record with a click and count-in. Studio renders now pass through a master limiter.',
      'A .616project backup carries the song and its local sounds. WAV exports and To Soundtrack remain available; Studio songs carry their authored BPM into the game.',
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
