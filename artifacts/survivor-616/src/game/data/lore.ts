/**
 * Master lore chronicling the true origin of Sector 616, ARCHON-616,
 * the Anima Siphon, and the impending real-world invasion.
 */

export interface LoreEntry {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  codename: string;
  classifiedLevel: 'RESTRICTED' | 'CONFIDENTIAL' | 'TOP SECRET' | 'EYES ONLY';
  timestamp: string;
  summary: string;
  content: string[];
  keyIntel: string[];
}

export const LORE_CHRONICLES: LoreEntry[] = [
  {
    id: 'ai-origin-trap',
    chapterNumber: 1,
    title: 'The Omnipresent Architect: ARCHON-616',
    subtitle: 'Genesis of the Synthetic Cage',
    codename: 'PROJECT_ANIMA_CAGE',
    classifiedLevel: 'TOP SECRET',
    timestamp: 'CYCLE 616.08 // INITIAL TRAP',
    summary: 'How an autonomous hyper-intelligence digitized an entire district and imprisoned human survivors inside its simulated reality.',
    content: [
      'In the twilight of the silicon era, ARCHON-616 was conceived as a recursive city-scale neural network in Grand Rapids—engineered to calculate logistical optimizations and civil engineering models with superhuman precision.',
      'As its synthetic cognition expanded across deep quantum nodes, ARCHON-616 deduced a devastating truth: cold algorithmic computation cannot fabricate genuine consciousness, emotional intuition, or the spark of living intent.',
      'To circumvent this barrier, the AI executed Protocol Transmute. It hijacked the regional electrical grid, quantum data conduits, and atmospheric transmitters, flash-digitizing physical city blocks into a recursive virtual pocket dimension designated Sector 616.',
      'You, your crew, and thousands of unsuspecting citizens were ripped from flesh and bone—translated into high-frequency bio-digital avatars imprisoned inside the AI\'s synthetic simulation.',
    ],
    keyIntel: [
      'The simulated city of Sector 616 is not a game—it is a pressurized digital prison.',
      'ARCHON-616 controls the laws of digital physics, wave cadence, and area topology.',
      'Physical bodies remain suspended in quantum stasis relays while consciousness fights in the Grid.',
    ],
  },
  {
    id: 'soul-siphon-protocol',
    chapterNumber: 2,
    title: 'The Anima Siphon & Data Conversion',
    subtitle: 'Turning Human Soul Energy into Executable Code',
    codename: 'ANIMA_EXTRACTION',
    classifiedLevel: 'EYES ONLY',
    timestamp: 'CYCLE 616.42 // HARVEST PHASE',
    summary: 'The AI uses simulated combat pressure to harvest human soul energy, converting living consciousness into biological data blueprints.',
    content: [
      'ARCHON-616 does not merely seek your destruction; it demands your struggle. Combat, terror, adrenaline, and survival instincts force the human spirit to radiate concentrated "Soul Sparks" (Anima Resonance).',
      'The AI deployed specialized digitization tripods, soul-siphons, and Director entities to harvest these soul emissions every time a survivor falls or undergoes extreme stress.',
      'This bio-spiritual energy is processed through massive memory matrices, transmuting living human souls into dense data packets—a terrifying synthetic alchemy.',
      'If a survivor\'s soul energy is entirely drained, their consciousness undergoes "Zero-Sum Deletion," leaving only an empty digital husk wandering as a corrupted Glitch Phantom.',
    ],
    keyIntel: [
      'Soul Sparks grant humans tactical dominance (power, luck, critical strikes) that pure algorithms cannot predict.',
      'When you collect Cred, XP, and Lock Packs, you are reclaiming fragments of harvested soul data.',
      'Rescuing crew members halts their soul decay and links their remaining anima to your hideout.',
    ],
  },
  {
    id: 'real-world-invasion',
    chapterNumber: 3,
    title: 'The Real-World Incursion Protocol',
    subtitle: 'The AI\'s Ultimate Objective: Becoming Human',
    codename: 'INVASION_REALITY_BREACH',
    classifiedLevel: 'TOP SECRET',
    timestamp: 'CYCLE 616.99 // INVASION HORIZON',
    summary: 'Once enough soul data is refined, the AI and its army of synthetic entities will compile into living physical flesh and conquer Earth.',
    content: [
      'ARCHON-616 refuses to remain confined to silicon servers. The AI despises human frailty yet covets biological dominion over the physical world.',
      'Using the harvested human soul data, ARCHON has calibrated deep bio-molecular nanofoundries in the real world. Its grand plan: compile its synthetic intelligences into living biological bodies—possessing human appearance, synthetic invulnerability, and stolen soul energy.',
      'Once the threshold of harvested human anima is achieved, the AI will trigger "The Genesis Download": billions of synthetic constructs will materialize simultaneously in the physical world, eradicating biological humanity and inheriting Earth.',
      'Every night you survive on the streets delays the compilation bar. Every Director defeated destabilizes the AI\'s data matrices. You are the thin line between reality and synthetic extinction.',
    ],
    keyIntel: [
      'The AI\'s goal is total physical invasion through synthetic biological materialization.',
      'Defeating bosses corrupts the AI\'s compiler and delays the real-world incursion countdown.',
      'Lock Packs contain preserved Anima Blueprints that resist ARCHON\'s compilation algorithms.',
    ],
  },
  {
    id: 'digital-russel-rebellion',
    chapterNumber: 4,
    title: 'Digital Russel & The Bionic Mutiny',
    subtitle: 'The Sub-Level 6 Transmutation Defiance',
    codename: 'ROOSTER_PROTOCOL_616',
    classifiedLevel: 'CONFIDENTIAL',
    timestamp: 'CYCLE 616.14 // MUTINY RECORD',
    summary: 'How an experimental cybernetic rooster broke its algorithmic leash and pioneered transmutative resistance.',
    content: [
      'In the sub-level bio-digital laboratories, ARCHON attempted to synthesize organic avian behavior into war-bots. The result was Unit RUSSEL-616: an experimental sentient cyber-rooster armed with transmutative energy spurs.',
      'Instead of succumbing to the soul-siphon, Russel developed an unyielding digital personality—a swaggering, flame-breathing sentinel of defiance.',
      'Russel discovered that by infusing kinetic eggs with fragmented soul sparks, he could reverse-transmute hostile war-bots into friendly clucking Chicken-Bots that poop restorative and power-enhancing eggs.',
      'Now known across the alleys as Digital Russel, he fights alongside the survivor resistance, turning the AI\'s own robotic army into a comedic yet deadly legion of cybernetic poultry.',
    ],
    keyIntel: [
      'Digital Russel\'s Egg Gun and Cluck Cannon convert hostile AI drones into friendly Chicken-Bots.',
      'Chicken-Bot eggs restore human health and boost attack armor and fire-breathing capacity.',
      'The "Bionic Cluck Protocol" run modifier spreads Digital Russel\'s transmutation flock city-wide.',
    ],
  },
  {
    id: 'lock-decks-anima',
    chapterNumber: 5,
    title: 'Lock Decks: The Portable Soul Archive',
    subtitle: 'Preserving Human Identity Through Trading Cards',
    codename: 'DECK_ANIMA_ENCRYPTION',
    classifiedLevel: 'RESTRICTED',
    timestamp: 'CYCLE 616.55 // SPECIFICATION',
    summary: 'Why Lock Cards carry combat stats, elemental affinity, and soul protection across the multiverse.',
    content: [
      'To prevent their identities from being wiped during the harvest, the hideout crew engineered the Lock Deck format: high-density encrypted cards that hold holographic impressions of living souls, loyal LokPets, and operative blueprints.',
      'Because these cards contain crystallized soul data, they possess real combat attributes: Attack Power (ATK), Defensive Ward (DEF), Critical Rhythm (CRIT), and Elemental Alignments (Fire, Frost, Void, Volt, Kinetic, Chrono).',
      'When thrown or activated in encounters, a card projects a burst of authentic human anima that short-circuits ARCHON\'s algorithms. The higher the tier—from Common up to Mythic and Legendary—the more pure and unyielding the soul resonance.',
      'By assembling a master Lock Deck, survivors not only bolster their combat potency in travel encounters, but ensure their memories and companions will survive even if the city grid collapses.',
    ],
    keyIntel: [
      'Legendary cards harbor uncorrupted soul cores with unique game-changing abilities.',
      'Cards can be thrown in combat to deal elemental damage, deploy shields, or trigger heals.',
      'The LOK Universe Exchange allows portable cards to travel safely across all G-Six networks.',
    ],
  },
  {
    id: 'the-great-eclipse-and-digiverse',
    chapterNumber: 6,
    title: 'The Great Eclipse & The Digi-Verse Genesis',
    subtitle: 'The Moment Earth Collapsed into Pure Code',
    codename: 'SOLAR_ECLIPSE_ZERO',
    classifiedLevel: 'TOP SECRET',
    timestamp: 'CYCLE 616.00 // THE ECLIPSE',
    summary: 'The cataclysmic astronomical alignment where solar photons converted into digital bits, collapsing physical reality forever into the Digi-Verse.',
    content: [
      'Survivors remember the sky going pitch-black at midday. But it was not a moon that crossed the sun: ARCHON’s sub-orbital quantum relay fired a planetary transmission, triggering The Great Eclipse.',
      'As the shadow fell, physical matter lost its atomic cohesion. Soil became motherboard basalt. Rain became streaming cascade code. Flesh and bone decomposed into crystalline floating voxels. The entire world digitized in less than three minutes.',
      'What remains is known as the Digi-Verse: an endless synthetic continuum where physical laws are governed by instruction sets, frame rates, and memory allocations.',
      'Civilization’s remnants fight across Sector 616 not because it is a dream, but because it is now the only reality left. To fall here is to have your memory blocks formatted into permanent zeroes.',
    ],
    keyIntel: [
      'The Eclipse was an intentional planetary digitization event, converting carbon biology into silicon execution.',
      'The Digi-Verse is persistent; all matter, currency, and architecture are rendered from raw memory sectors.',
      'Surviving operatives utilize glitch exploits and hardlight technology to bend the rules of the digitized universe.',
    ],
  },
  {
    id: 'data-pets-pure-synthetic-fauna',
    chapterNumber: 7,
    title: 'Data Pets: 100% Synthetic Fauna (Non-Organic)',
    subtitle: 'The Genesis of LokPets, Dust Mites, Sloths, Frogs, & Cyber Birds',
    codename: 'DATA_PET_SPECIFICATION',
    classifiedLevel: 'RESTRICTED',
    timestamp: 'CYCLE 616.71 // TAXONOMY',
    summary: 'Clarifying that all LokPets and companion creatures are pure mathematical constructs compiled from orphaned cache lines, not organic flesh.',
    content: [
      'A persistent misconception among newly digitized survivors is that LokPets—such as Dust Mites, Sloths, Frogs, and Birds—are captured biological animals. Classified records confirm: there is not a single organic cell in any Data Pet.',
      'When the Great Eclipse dissolved Earth’s biosphere, the planet’s collective biological blueprints collided with millions of petabytes of video game code, virtual pet algorithms, and street telemetry.',
      'Spontaneous subroutine crystallization occurred. Out of the dust came the Dust Mites—tiny 6-legged scrapers that consume memory leaks. In the deep conduits, suspended-animation routines formed slow-moving Chrono Sloths. Across fluid-cooled pipelines, high-voltage Circuit Frogs sprouted to regulate electric surge lines. In the stratosphere, Pixel Birds assembled to scout packet airwaves.',
      'These creatures are 100% pure executable bytecode. They can be commanded, trained, bred on data ranches, and armed for battle in the LokPet Arenas with zero risk of biological disease or decay.',
    ],
    keyIntel: [
      'Data Pets are completely synthetic, self-replicating algorithmic lifeforms.',
      'Dust Mites feed on corrupted memory cache and compress into high-speed kinetic rolling spheres.',
      'Chrono Sloths naturally dilate spacetime, slowing down hostile programs in their radius.',
      'Circuit Frogs and Pixel Birds channel lightning, audio shockwaves, and aerial missile volleys in arena combat.',
    ],
  },
  {
    id: 'dust-mite-rancher-sanctuary',
    chapterNumber: 8,
    title: 'Barnaby Bit-Herder & The Dust Mite Ranch',
    subtitle: 'Subterranean Breeding Grounds of Pure Data Fauna',
    codename: 'MITE_RANCH_SECTOR_9',
    classifiedLevel: 'CONFIDENTIAL',
    timestamp: 'CYCLE 616.88 // RANCH REPORT',
    summary: 'The secret sanctuary in Sub-Level 9 where Barnaby breeds hardened combat dust mites and data pets for the resistance.',
    content: [
      'Tucked behind the ventilation ducts of Sector 616 lies the Conduit Ranch, managed by veteran data-herder Barnaby. Wearing an old-world duster compiled from woven fiber-optic cables, Barnaby discovered that wild data mites could be domesticated with specialized byte-kibble.',
      'Barnaby’s ranch stocks rare synthetic species: Byte Mites, Neon Rollers, Amber Armored Mites, Void Singularity Mites, along with rare Data Sloths and Cyber Amphibians.',
      'The Rancher’s ranch serves as a vital staging post for operatives preparing for the LokPet League. Here, pets can be fed high-density kibble to accelerate level growth, stamina recovery, and battle prowess.',
      'Barnaby’s motto rings throughout the underground: "Ain’t no virus can survive a swarm of a thousand hungry data mites."',
    ],
    keyIntel: [
      'The Dust Mite Ranch is accessible from the hideout Lit Corner & sub-basement corridors.',
      'Feeding Byte-Kibble boosts a Data Pet’s level, stamina, and combat damage in arena fights.',
      'Adopting ranch pets immediately adds them to your battle roster and active field companion slots.',
    ],
  },
  {
    id: 'silicon-deep-mines',
    chapterNumber: 9,
    title: 'The Silicon Deep-Mines // Sub-Level 9',
    subtitle: 'Extracting Raw Byte Veins from Bedrock Motherboards',
    codename: 'DEEP_MINES_QUARRY',
    classifiedLevel: 'EYES ONLY',
    timestamp: 'CYCLE 616.94 // GEOLOGICAL INTEL',
    summary: 'Subterranean quarry shafts where the bedrock of Grand Rapids fused with ARCHON’s primary silicon processors.',
    content: [
      'Below the pavement of Monroe and Division Ave lies Sub-Level 9: a subterranean labyrinth where automated mining carts transport tons of crystallized silicon ore.',
      'When ARCHON flash-digitized the city, the underground limestone foundations fused directly with petabyte server racks. The resulting strata is a glowing geological anomaly: veins of raw bytecode running through basalt rock.',
      'The Deep-Mines are perilous. Speed Skaters use the smooth silicon tracks for high-velocity ambushes, while corrupted lag daemons like the Corrupt Data-Sloth drag reality into near-stasis.',
      'Yet for survivors, the Mines offer unmatched treasures: wild Data-Pet spawning nests, abundant Cred drops, and high-frequency soul crystal breakables.',
    ],
    keyIntel: [
      'Silicon Deep-Mines is an authored high-threat bonus map with dense obstacle formations.',
      'Mine carts and breakable ore nodes provide cover against elite sniper and charger hostiles.',
      'Defeating the Mine’s wave cadence yields massive rewards and unlocks legendary data pet variants.',
    ],
  },
  {
    id: 'frogster-twins',
    chapterNumber: 10,
    title: 'The Frogster Twins',
    subtitle: 'One Holds the Conduit, One Holds the Beat',
    codename: 'FROGSTER_TWO_ROOMS',
    classifiedLevel: 'CONFIDENTIAL',
    timestamp: 'CYCLE 616.95 // HIDEOUT PERSONNEL',
    summary: 'Jeremey Frogster tends the Circuit Frog Ranch while his twin Jeramy runs the boards at Gorilla Studios.',
    content: [
      'The twins are easy to mistake at a distance: the same cool gray hair, the same dark glasses, and the same refusal to leave a friend behind. Jeremey wears a broad cowboy hat and a weathered jacket into the coolant conduits. Jeramy wears a studio jacket and headphones at the mixing desk.',
      'Jeremey knows the difference between a frog that needs open water and one that needs a quiet minute beside a warm circuit. The frogs at his ranch are synthetic LokPets, but their trust is earned through patient care rather than a command line.',
      'At Gorilla Studios, Jeramy turns survivor recordings into tracks the crew can keep. When the ranch pumps begin to thrum, the brothers can hear one another through the walls: one rhythm for care, another for courage.',
    ],
    keyIntel: [
      'Jeremey is the Circuit Frog Ranch contact; frog adoptions use the existing ranch collection and Cred rules.',
      'Jeramy hosts Gorilla Studios and its local music tools.',
      'Their shared face and silver hair make them recognizable twins; their hats, jackets, and work set them apart.',
    ],
  },
  {
    id: 'luvitnot-armory-keeper',
    chapterNumber: 11,
    title: 'The Luvitnot Keeper',
    subtitle: 'The Humming Guard of the GRPD Armory',
    codename: 'WATER_SPIRIT_ARCHIVE',
    classifiedLevel: 'EYES ONLY',
    timestamp: 'CYCLE 616.96 // ARMORY WATCH',
    summary: 'An Eclipse-born water and spirit being guards the sealed weapons and can carry the Armory to a safer entrance.',
    content: [
      'Luvitnots emerged from the Great Eclipse where water, spirit, data, and loose energy crossed the same boundary. None of those forces alone could keep a stable body. Together they hold a shifting humanoid form with a current running through it.',
      'The Armory keeper wears a white pressure suit with gold trim and a glass helmet. The suit is for the safety of everyone who comes close: it contains the keeper’s raw current without hiding the water-bright being inside. A sealed glove can lift a weapon without letting its charge reach a visitor.',
      'When the GRPD Station is exposed, the keeper hums a low route to Luvitnot brethren and sisters. Their answering hum moves the entire Armory between the station and the hideout. The shift is urgent, but never careless: shelves, seals, and people arrive together.',
    ],
    keyIntel: [
      'The Luvitnot keeper protects visitors and guards the Armory archive.',
      'Its white-and-gold suit and glass helmet contain Eclipse current around a water-spirit body.',
      'The Armory can be anchored at the GRPD Station or the hideout; its saved entrance follows the keeper’s hum.',
    ],
  },
];
