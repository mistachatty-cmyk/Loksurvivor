# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lock-decks.spec.ts >> Lock Deck card packs >> renders pack slots, real operative cards, and card details
- Location: e2e/lock-decks.spec.ts:12:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog', { name: 'Card details' })
Expected substring: "Shade"
Received string:    "VIRuncommon🛡️🌪️ InspectUnknown Card183 HP◆BastionClassicDynamic 3DRetro Streamlined BaseSolid-Core TerraDual: Gale-Packet AeroVirus🛡️ BastionBasicUnknown Card№ 097/150 · ◆ · Solar Phoenix · Sector OperativesThis slot is sealed. Find or buy a Lock Pack to reveal a copy.\"Archived in the high-security LokVault. Legends state its signature attack can rewrite corrupted firmware.\"HP Capacity183Attack Power37Armor Defense33Speed Haste126SP Gauge46Throw DMG56ABILITY · Granite FirewallAEGISNegates the first hit received in each wave.Solid-Core Strike (18 SP)28 DMGGranite Firewall (46 SP)59 DMGWeakness / ResistanceWeak: aero · Res: voltFoil Finishfoil Dominates: Volt-Surge Electric, Null-Glitch CorruptVulnerable: Gale-Packet Aero, Pyro-Bit Fire"
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('dialog', { name: 'Card details' }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Card details' })
    14 × locator resolved to <div role="dialog" aria-modal="true" aria-label="Card details" class="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 sm:p-5 backdrop-blur-md">…</div>
       - unexpected value "VIRuncommon🛡️🌪️ InspectUnknown Card183 HP◆BastionClassicDynamic 3DRetro Streamlined BaseSolid-Core TerraDual: Gale-Packet AeroVirus🛡️ BastionBasicUnknown Card№ 097/150 · ◆ · Solar Phoenix · Sector OperativesThis slot is sealed. Find or buy a Lock Pack to reveal a copy."Archived in the high-security LokVault. Legends state its signature attack can rewrite corrupted firmware."HP Capacity183Attack Power37Armor Defense33Speed Haste126SP Gauge46Throw DMG56ABILITY · Granite FirewallAEGISNegates the first hit received in each wave.Solid-Core Strike (18 SP)28 DMGGranite Firewall (46 SP)59 DMGWeakness / ResistanceWeak: aero · Res: voltFoil Finishfoil Dominates: Volt-Surge Electric, Null-Glitch CorruptVulnerable: Gale-Packet Aero, Pyro-Bit Fire"

```

```yaml
- dialog "Card details":
  - button "Close card details"
  - button "Unknown Card (uncommon) - click for details":
    - text: VIR uncommon 🛡️ 🌪️ Inspect
    - paragraph: Unknown Card
    - text: 183 HP ◆ Bastion
  - button "Classic"
  - button "Dynamic 3D"
  - paragraph: Retro Streamlined Base
  - text: "Solid-Core Terra Dual: Gale-Packet Aero Virus 🛡️ Bastion Basic"
  - heading "Unknown Card" [level=3]
  - paragraph: № 097/150 · ◆ · Solar Phoenix · Sector Operatives
  - paragraph: This slot is sealed. Find or buy a Lock Pack to reveal a copy.
  - paragraph: "\"Archived in the high-security LokVault. Legends state its signature attack can rewrite corrupted firmware.\""
  - text: HP Capacity 183 Attack Power 37 Armor Defense 33 Speed Haste 126 SP Gauge 46 Throw DMG 56 ABILITY · Granite Firewall AEGIS
  - paragraph: Negates the first hit received in each wave.
  - text: "Solid-Core Strike (18 SP) 28 DMG Granite Firewall (46 SP) 59 DMG Weakness / Resistance Weak:"
  - strong: aero
  - text: "· Res:"
  - strong: volt
  - text: "Foil Finish foil Dominates:"
  - strong: Volt-Surge Electric, Null-Glitch Corrupt
  - text: "Vulnerable:"
  - strong: Gale-Packet Aero, Pyro-Bit Fire
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
> 17 |     await expect(page.getByRole('dialog', { name: 'Card details' })).toContainText('Shade');
     |                                                                      ^ Error: expect(locator).toContainText(expected) failed
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
  32 |     await expect(page.getByRole('heading', { name: 'LokPet Card Shop' })).toBeVisible();
  33 |     await expect(page.getByTestId('button-card-shop-open-pack')).toBeVisible();
  34 |     await expect(page.locator('[data-testid^="button-card-pack-"]')).toHaveCount(5);
  35 |   });
  36 | });
  37 | 
```