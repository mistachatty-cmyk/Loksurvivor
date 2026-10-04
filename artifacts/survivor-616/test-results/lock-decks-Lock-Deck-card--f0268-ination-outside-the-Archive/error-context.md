# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lock-decks.spec.ts >> Lock Deck card packs >> has a dedicated card-shop destination outside the Archive
- Location: e2e/lock-decks.spec.ts:29:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'LokPet Card Shop' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'LokPet Card Shop' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'LokPet Card Shop' })

```

```yaml
- banner:
  - button "Back"
  - paragraph: The Neon Sleeve · Hideout location
  - heading "Lock Pack Counter" [level=1]
- main:
  - paragraph: Card shop · Cyber Deck & Collector Arena
  - heading "Lock Pack Bar" [level=2]
  - paragraph: Trading Cards feature authentic 3D holographic foil physics, multi-element & hybrid fighting style affinities, and tactical battle deck compatibility.
  - paragraph: Blue boxes pay 2 CC · duplicates can be recycled or saved for variants
  - text: 0 CC
  - button "Pull Rates & Odds"
  - button "Variables Matrix"
  - text: TIER I
  - heading "Scrap Runner" [level=2]
  - paragraph: Standard access to Lock Deck binder and booster packs.
  - text: "Collection:"
  - strong: 0 / 311 Cards
  - text: "(0 Holo/Glitch) Next: District Sifter (10 cards needed) Tier Progress 0% -35% OFF DAILY FLASH SPECIAL"
  - paragraph: Quantum Singularity Booster (Flash Special)
  - paragraph: High-energy anomaly pack containing 5 cards with elevated mythic & foil odds.
  - text: 48 CC
  - strong: 31 CC
  - button "Rip Deal · 31 CC" [disabled]
  - paragraph: Auto-open packs
  - paragraph: Bought and found packs rip open instantly.
  - button "On · open instantly" [pressed]
  - article:
    - text: 1 cards
    - heading "Street Sleeve" [level=3]
    - paragraph: One card from the full Survivor 616 catalog.
    - button "Open · 8 CC" [disabled]
  - article:
    - text: 2 cards
    - heading "Roster Roll" [level=3]
    - paragraph: Two character cards from the playable roster.
    - button "Open · 12 CC" [disabled]
  - article:
    - text: 2 cards
    - heading "Beyond the Grid" [level=3]
    - paragraph: Two rule-bending Scenario Cards.
    - button "Open · 14 CC" [disabled]
  - article:
    - text: 2 cards
    - heading "LokPack" [level=3]
    - paragraph: Two LokPet subject or passive cards.
    - button "Open · 14 CC" [disabled]
  - article:
    - text: 3 cards
    - heading "Elemental LokPack" [level=3]
    - paragraph: Three elemental synergy and companion cards.
    - button "Open · 18 CC" [disabled]
  - article:
    - text: 3 cards
    - heading "Collector Cache" [level=3]
    - paragraph: Three mixed cards with stronger variant odds.
    - button "Open · 22 CC" [disabled]
  - article:
    - text: 3 cards
    - heading "Prism LokPack" [level=3]
    - paragraph: Three LokPet cards with boosted mythic & holo odds.
    - button "Open · 26 CC" [disabled]
  - article:
    - text: 3 cards
    - heading "Neon Cipher" [level=3]
    - paragraph: Three passive cards with high rare and Holo odds.
    - button "Open · 30 CC" [disabled]
  - article:
    - text: 5 cards
    - heading "Apex Vault Pack" [level=3]
    - paragraph: Five premium cards with maximum variant & holo rates.
    - button "Open · 42 CC" [disabled]
  - article:
    - text: 5 cards
    - heading "Quantum Singularity Booster" [level=3]
    - paragraph: Five high-energy cards with extreme mythic and secret-rare odds.
    - button "Open · 48 CC" [disabled]
  - article:
    - text: 3 cards
    - heading "Prismatic Shiny Cache" [level=3]
    - paragraph: Three cards with guaranteed Foil, Holo, or Glitch variant finishes.
    - button "Open · 36 CC" [disabled]
  - article:
    - text: 5 cards
    - heading "Apex Dominion Booster" [level=3]
    - paragraph: Five premier LokPet cards featuring ultra-rare apex bodies and signatures.
    - button "Open · 54 CC" [disabled]
  - article:
    - text: 7 cards
    - heading "Mega Vault Pack" [level=3]
    - paragraph: Seven premium cards -- the deepest pull in the Bar, with the highest holo rate around.
    - button "Open · 64 CC" [disabled]
  - button "Lock Deck Binder"
  - button "Singles Showcase"
  - button "Card Recycle Depot"
  - button "Passive Lock Deck"
  - button "Battle Deck"
  - button "Variables Matrix"
  - button "Show all"
  - heading "Lock Deck Binder" [level=2]
  - text: 0/311 subjects · 0 copies
  - button "616 Playable character pack Sector Operatives 0/69 collected" [pressed]
  - button "X Bestiary pack Night Shift Threats 0/136 collected"
  - button "H Companion pack Hideout Crew 0/20 collected"
  - button "LP LokPet discovery pack Spirit Beasts 0/78 collected"
  - button "∞ Endless chase pack Beyond the Grid 0/8 collected"
  - paragraph: Sector Operatives
  - paragraph: Every survivor you can field, rendered from their real in-game rig.
  - button "Variables & Synergy Matrix"
  - textbox "Search this card pack":
    - /placeholder: Search this pack
  - button "Collected only"
  - text: "Filter:"
  - combobox:
    - option "All Elements" [selected]
    - option "● Kinetic"
    - option "🔥 Pyro-Bit Fire"
    - option "❄️ Cryo-Byte Freeze"
    - option "⏳ Chrono-Lag Slow"
    - option "⚡ Volt-Surge Electric"
    - option "👾 Null-Glitch Corrupt"
    - option "🛡️ Solid-Core Terra"
    - option "🌪️ Gale-Packet Aero"
    - option "✨ Photon-Array Light"
    - option "🌑 Void-Sector Dark"
  - combobox:
    - option "All Data Types" [selected]
    - option "VAC - Vaccine"
    - option "VIR - Virus"
    - option "DAT - Data"
    - option "CYB - Cyber"
    - option "QTM - Quantum"
  - combobox:
    - option "All Fighting Styles" [selected]
    - option "⚔️ Striker"
    - option "💥 Blaster"
    - option "🛡️ Bastion"
    - option "🃏 Trickster"
    - option "⚡ Speedster"
    - option "🔮 Weaver"
  - button "Dual Elements"
  - button "Multi-Variable"
  - text: "Card Style:"
  - button "Classic View (Base)"
  - button "Dynamic 3D"
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🛡️ 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 183 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 ⏳ Inspect
    - paragraph: Unknown Card
    - text: 232 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon ● 🌑 1st Inspect
    - paragraph: Unknown Card
    - text: 209 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⚡ Inspect
    - paragraph: Unknown Card
    - text: 213 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⚡ Inspect
    - paragraph: Unknown Card
    - text: 191 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⏳ ❄️ Inspect
    - paragraph: Unknown Card
    - text: 146 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ● 1st Inspect
    - paragraph: Unknown Card
    - text: 176 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ⏳ Inspect
    - paragraph: Unknown Card
    - text: 201 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🌑 Inspect
    - paragraph: Unknown Card
    - text: 142 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ✨ 👾 Inspect
    - paragraph: Unknown Card
    - text: 178 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 189 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ❄️ Inspect
    - paragraph: Unknown Card
    - text: 233 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ⏳ Inspect
    - paragraph: Unknown Card
    - text: 179 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 184 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 146 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ● 1st Inspect
    - paragraph: Unknown Card
    - text: 198 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ● 1st Inspect
    - paragraph: Unknown Card
    - text: 176 HP ◆ Blaster
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 210 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🌑 Inspect
    - paragraph: Unknown Card
    - text: 164 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ⏳ Inspect
    - paragraph: Unknown Card
    - text: 201 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 ⏳ Inspect
    - paragraph: Unknown Card
    - text: 166 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 210 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 221 HP ◆ Blaster
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon ● ⏳ 1st Inspect
    - paragraph: Unknown Card
    - text: 209 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: QTM uncommon 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 239 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon ● 🌑 1st Inspect
    - paragraph: Unknown Card
    - text: 209 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: QTM uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 240 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⚡ 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 191 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 👾 ⏳ 1st Inspect
    - paragraph: Unknown Card
    - text: 193 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ✨ 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 152 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon ⚡ Inspect
    - paragraph: Unknown Card
    - text: 202 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon ❄️ Inspect
    - paragraph: Unknown Card
    - text: 142 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ❄️ 🌑 Inspect
    - paragraph: Unknown Card
    - text: 233 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 👾 1st Inspect
    - paragraph: Unknown Card
    - text: 171 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 👾 Inspect
    - paragraph: Unknown Card
    - text: 188 HP ◆ Trickster
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 🌑 🔥 1st Inspect
    - paragraph: Unknown Card
    - text: 338 HP ★★★ Bastion
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary ⚡ 1st Inspect
    - paragraph: Unknown Card
    - text: 248 HP ★★★ Blaster
  - button "Unknown Card (legendary) - click for details":
    - text: CYB legendary ❄️ 1st Inspect
    - paragraph: Unknown Card
    - text: 424 HP ★★★ Speedster
  - button "Unknown Card (legendary) - click for details":
    - text: QTM legendary 🌪️ 1st Inspect
    - paragraph: Unknown Card
    - text: 274 HP ★★★ Speedster
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 🌑 1st Inspect
    - paragraph: Unknown Card
    - text: 398 HP ★★★ Trickster
  - button "Unknown Card (legendary) - click for details":
    - text: QTM legendary 🌪️ 1st Inspect
    - paragraph: Unknown Card
    - text: 354 HP ★★★ Striker
  - button "Unknown Card (legendary) - click for details":
    - text: DAT legendary ● 🌑 1st Inspect
    - paragraph: Unknown Card
    - text: 260 HP ★★★ Weaver
  - button "Unknown Card (legendary) - click for details":
    - text: QTM legendary ⚡ 1st Inspect
    - paragraph: Unknown Card
    - text: 438 HP ★★★ Bastion
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 👾 1st Inspect
    - paragraph: Unknown Card
    - text: 350 HP ★★★ Striker
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 🛡️ ⏳ 1st Inspect
    - paragraph: Unknown Card
    - text: 252 HP ★★★ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: QTM uncommon 🌪️ 🌑 Inspect
    - paragraph: Unknown Card
    - text: 151 HP ◆ Blaster
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ❄️ Inspect
    - paragraph: Unknown Card
    - text: 156 HP ◆ Bastion
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon ⏳ Inspect
    - paragraph: Unknown Card
    - text: 140 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 188 HP ◆ Weaver
  - button "Unknown Card (uncommon) - click for details":
    - text: QTM uncommon 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 239 HP ◆ Speedster
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary ❄️ 🛡️ 1st Inspect
    - paragraph: Unknown Card
    - text: 364 HP ★★★ Striker
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary ⏳ 1st Inspect
    - paragraph: Unknown Card
    - text: 246 HP ★★★ Trickster
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary ✨ 1st Inspect
    - paragraph: Unknown Card
    - text: 376 HP ★★★ Trickster
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 🌑 1st Inspect
    - paragraph: Unknown Card
    - text: 338 HP ★★★ Speedster
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 👾 1st Inspect
    - paragraph: Unknown Card
    - text: 410 HP ★★★ Striker
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary ● 1st Inspect
    - paragraph: Unknown Card
    - text: 280 HP ★★★ Striker
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary 🔥 1st Inspect
    - paragraph: Unknown Card
    - text: 402 HP ★★★ Speedster
  - button "Unknown Card (legendary) - click for details":
    - text: VAC legendary ● 1st Inspect
    - paragraph: Unknown Card
    - text: 360 HP ★★★ Blaster
  - button "Unknown Card (legendary) - click for details":
    - text: QTM legendary 🌪️ 1st Inspect
    - paragraph: Unknown Card
    - text: 314 HP ★★★ Weaver
  - button "Unknown Card (legendary) - click for details":
    - text: VIR legendary 🌑 ⚡ 1st Inspect
    - paragraph: Unknown Card
    - text: 338 HP ★★★ Blaster
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ❄️ ✨ Inspect
    - paragraph: Unknown Card
    - text: 222 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon 🔥 Inspect
    - paragraph: Unknown Card
    - text: 166 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: DAT uncommon ● 1st Inspect
    - paragraph: Unknown Card
    - text: 143 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⚡ Inspect
    - paragraph: Unknown Card
    - text: 213 HP ◆ Speedster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 👾 1st Inspect
    - paragraph: Unknown Card
    - text: 171 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: VAC uncommon ✨ Inspect
    - paragraph: Unknown Card
    - text: 174 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🌑 Inspect
    - paragraph: Unknown Card
    - text: 186 HP ◆ Striker
  - button "Unknown Card (uncommon) - click for details":
    - text: CYB uncommon ⏳ Inspect
    - paragraph: Unknown Card
    - text: 168 HP ◆ Trickster
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 162 HP ◆ Weaver
  - paragraph: Click any card to inspect full tactical intel, combat moves, synergies, and variable affinities. Switch to Dynamic 3D for holographic foil tilt.
- 'button "Now playing: Data Spark — Hidden Track 0. Open music controls."'
- region "Notifications (F8)":
  - list
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | 
  3  | test.describe('Lock Deck card packs', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.addInitScript(() => {
  6  |       localStorage.setItem('survivor616.meta.v1', JSON.stringify({ onboarded: true }));
  7  |     });
  8  |     await page.goto('/?screen=archive');
  9  |     await page.getByTestId('button-archive-tab-cards').click();
  10 |   });
  11 | 
  12 |   test('renders pack slots, real operative cards, and card details', async ({ page }) => {
  13 |     await expect(page.getByTestId('section-cards')).toBeVisible();
  14 |     await expect(page.locator('[data-testid^="button-card-pack-"]')).toHaveCount(5);
  15 |     await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
  16 |     await page.getByTestId('card-lok-character-shade').click();
  17 |     await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('Shade');
  18 |     await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('g6.616-survivor:character-shade');
  19 |   });
  20 | 
  21 |   test('keeps the binder usable at phone width', async ({ page }) => {
  22 |     await page.setViewportSize({ width: 390, height: 844 });
  23 |     await expect(page.getByTestId('button-card-pack-operatives')).toBeVisible();
  24 |     await expect(page.getByTestId('card-lok-character-shade')).toBeVisible();
  25 |     const bodyOverflows = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
  26 |     expect(bodyOverflows).toBe(false);
  27 |   });
  28 | 
  29 |   test('has a dedicated card-shop destination outside the Archive', async ({ page }) => {
  30 |     await page.goto('/?screen=card-shop');
  31 |     await expect(page.getByTestId('section-card-shop')).toBeVisible();
> 32 |     await expect(page.getByRole('heading', { name: 'LokPet Card Shop' })).toBeVisible();
     |                                                                           ^ Error: expect(locator).toBeVisible() failed
  33 |     await expect(page.getByTestId('button-card-shop-open-pack')).toBeVisible();
  34 |     await expect(page.locator('[data-testid^="button-card-pack-"]')).toHaveCount(5);
  35 |   });
  36 | });
  37 | 
```