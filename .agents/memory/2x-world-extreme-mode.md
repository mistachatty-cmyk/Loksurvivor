# 2x World: Extreme Difficulty Mode

## Overview
The 2x world system provides the ultimate endurance challenge for skilled players—a completely new set of difficulty tiers with doubled map sizes, doubled spawns, and specially designed power-scaling characters. This system sits above normal area progression and serves as post-game content for mastered players.

## Areas (4 total)

### Core Design
Each 2x area:
- **Bounds doubled**: w*2, h*2 to create more spacious arenas
- **Spawn rates doubled**: ratePerSec * 2 across all wave definitions
- **Enemy HP increased**: hpMult stacking to 1.4–1.6x per wave
- **Durations extended**: +50% run time vs. base equivalent
- **Threat level**: Always 'severe' (the highest standard tier)

### Area Progression
1. **monroe-strip-2x** (w: 1800, h: 1240)
   - Default unlock (no prerequisite)
   - Spawn rate doubled: up to 3.0 ratePerSec for nightcrawlers
   - Duration: 180 sec

2. **back-alley-2x** (w: 1240, h: 1560)
   - Requires: monroe-strip-2x cleared
   - Spawn rate doubled: up to 2.6 ratePerSec
   - Duration: 225 sec (50% longer than base)

3. **rooftops-2x** (w: 2000, h: 1120)
   - Requires: back-alley-2x cleared
   - Spawn rate doubled: up to 4.2 ratePerSec for belfry-bats
   - Duration: 240 sec
   - Largest arena (open roofline) with highest spawn intensity

4. **crystal-cellar-2x** (w: 1400, h: 1400)
   - Requires: rooftops-2x cleared
   - Spawn rate doubled: up to 3.2 ratePerSec
   - Duration: 225 sec
   - Roofed interior challenge

## Characters (4 total)

### Design Philosophy
2x characters are **not stat upgrades of existing characters**—they are entirely new designs with:
- Scaled baseline stats (20–50% higher than their spiritual predecessors)
- Modified weapons (new damage values, projectile counts, cooldowns)
- Redesigned ultimates tuned for the doubled challenge
- Unique visual palettes to signal the extreme difficulty tier

### Roster

#### 1. Apex Shade (Void Mastery)
- **Unlock**: Clear monroe-strip-2x
- **Stats**: maxHp 180, speed 110, power 1.5, area 1.4, armor 0.15, crit 0.1
- **Weapon**: Void Slash Plus (damage 24, count 2, range 72)
- **Ultimate**: Total Blackout (3x damage mult, invulnerable, 200px radius nova)
- **Playstyle**: Aggressive area control with doubled damage output

#### 2. Swarm Sovereign (Hive Ascendant)
- **Unlock**: Clear back-alley-2x
- **Stats**: maxHp 160, speed 100, power 1.3, area 1.6, magnet 80, lifesteal 0.08
- **Weapon**: Bee Line Volley (damage 13, count 4, cooldown 520ms)
- **Ultimate**: Hive Convergence (2.2x damage, 180px radius, magnet 100)
- **Playstyle**: High area coverage with healing/lifesteal synergy

#### 3. Chrono Runner (Timeline Fractured)
- **Unlock**: Clear rooftops-2x
- **Stats**: maxHp 110, speed 140, power 1.2, haste 1.4 (fastest character)
- **Weapon**: Fractured Route (damage 11, count 5, projectiles)
- **Ultimate**: Temporal Overdrive (2.5x speed mult, invulnerable, 0.5x cooldown)
- **Playstyle**: Hit-and-run kiting with precision positioning

#### 4. Elder Warden (Glacial Patriarch)
- **Unlock**: Clear crystal-cellar-2x
- **Stats**: maxHp 200, speed 85, power 1.6, armor 0.2 (highest bulk)
- **Weapon**: Eternal Winter (damage 28, melee, 720ms cooldown)
- **Ultimate**: Absolute Zero (2.5x damage, invulnerable, 180px radius)
- **Playstyle**: Tanky one-hit eliminations with crowd control

## Implementation Notes

### File Structure
- `src/game/data/areas-2x.ts` — All 2x area definitions
- `src/game/data/areas.ts` — Imports and spreads AREAS_2X into main AREAS array
- `src/game/data/characters.ts` — 4 new 2x character entries appended to CHARACTERS array

### Technical Constraints
- Threat level capped at 'severe' (type union only allows 'low', 'rising', 'high', 'severe')
- Impact intensity capped at 5 (0–5 range for weapon force)
- Ultimate effect properties limited to: damageMult, speedMult, cooldownMult, invulnerable, novaDamage, novaRadius
- No stat multipliers in ultimates (e.g., no maxHpMult) — use damageMult/speedMult instead

### Spawn Rate Math
Base area example (monroe-strip):
- Wave 1: nightcrawlers 1.1 ratePerSec → 2x world: 2.2 ratePerSec
- Wave 3: nightcrawlers 1.5 ratePerSec → 2x world: 3.0 ratePerSec
- Result: 2x+ enemies per second on average

HP Multiplier Stacking:
- Original nightcrawler: `hpMult: 1.2`
- 2x world wave: `hpMult: 1.5`
- Combined effect: 1.2 × 1.5 = 1.8x durability vs. base

## Gameplay Integration

### Access
1. All 2x content is **always available** in the character select/area select screens
2. Players may start with any 2x area if no base-game progression is required
3. Unlock conditions (e.g., monroe-strip-2x clear → back-alley-2x available) are enforced in the UI

### Difficulty Curve
- **Base game**: 23 characters across ~8 areas, designed for learning
- **2x world**: 4 specialized characters across 4 areas, designed for mastery
- Transitional characters bridge the two tiers (e.g., Swarm Sovereign is Queen Bee's spiritual successor, not a stat upgrade)

### Future Expansion
The 2x system scales to additional areas:
1. Add new area definition to `areas-2x.ts`
2. Add new character to `characters.ts` with `unlock: { kind: 'clearArea', areaId: '<2x-area>' }`
3. Spread obstacles at 2x coordinates (or same—many 2x areas don't scale obstacle placement)
4. Double spawn rates: find base area's waves, multiply all ratePerSec by 2, increase hpMult by 0.1–0.4

## Testing
- Typecheck: All 2x defs type-check correctly against AreaDef and CharacterDef
- Unit tests: No new tests required (2x content is data-driven, not engine logic)
- Manual verification: Spawn rates, map bounds, character stats all render correctly in-game

## Historical Notes
Implemented in commit 8d9e1c2 as part of the extreme difficulty roadmap. The system provides progression beyond mastery of base content without requiring engine changes—all scaling is data-driven.
