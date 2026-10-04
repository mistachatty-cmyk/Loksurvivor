# Loksurvivor Character Design Architecture & Archetype Guide

This architectural guide establishes the design framework, archetype taxonomy, stat budgets, and passive ability systems for all playable operatives in Loksurvivor.

---

## 1. Character Archetype Taxonomy

Every character in Loksurvivor belongs to one primary combat archetype:

| Archetype | Core Identity | Primary Triggers | Gameplay Fantasy |
| :--- | :--- | :--- | :--- |
| **Skirmisher** | High Mobility & Kinetic Momentum | `movement`, `on-dash` | Rewarding continuous movement, hit-and-run strafing, and high kinetic repositioning. |
| **Berserker** | Risk/Reward Low-HP Escalation | `low-hp`, `continuous` | Scaling lethal attack power, critical surges, and furious counterattacks as health drops. |
| **Tactician** | Positional Bastion & Strategic Zones | `stationary`, `continuous` | Dominating terrain with defensive bastions, standing bulwarks, and expanded area coverage. |
| **Commander** | Minion, Swarm & Orbital Synchrony | `continuous`, `kill-streak` | Amplifying companion followers, royal bee swarms, satellites, and orbital projectile fields. |
| **Elementalist** | Status Propagation & Rhythm Resonance | `elemental`, `continuous` | Chaining burning, freezing, corrosive acid, and corrupted resonance across dense waves. |
| **Saboteur** | Ambush, Stealth & Execution Strikes | `on-dash`, `kill-streak` | Exploiting stealth windows, high single-target backstabs, and critical execution bursts. |
| **Collector** | Resource Siphon & Reward Optimization | `kill-streak`, `continuous` | Maximizing scrap extraction, card pack discovery, and vacuum pickup magnetism. |

---

## 2. Stat Budgeting Principles

To ensure distinctive feel without power creep:
- **Baseline Average:** 100 HP, 100 Speed, 1.0 Power, 1.0 Area, 1.0 Haste, 60 Magnet, 0.05 Armor, 0.05 Crit.
- **Budget Offsets:**
  - High Speed (>110) must trade off with Max HP (<95) or Armor (<0.04).
  - Heavy Tanks (>125 HP, >0.15 Armor) must have slower baseline movement (<=88 Speed).
  - High Area or Power multipliers (>1.15) should be offset by slower attack cadence (Haste >= 1.05s cooldown multiplier).
- **Stat Modifiers on Passive Abilities:**
  - `passiveAbility.statModifiers` directly augment the character's base stats during run initialization in `world.ts`.
  - Passive stat modifiers must be tuned to reinforce archetype identity (e.g. Skirmishers get Speed & Magnet, Tacticians get Armor & Area, Berserkers get Power & Crit).

---

## 3. Dynamic Archetype Combat Hooks

In `world.ts`, the combat engine processes archetype-specific passive triggers during active runs:

1. **Skirmisher Velocity Bonus:**
   When player speed exceeds 80 px/s, weapon strikes gain an innate +15% damage bonus.
2. **Berserker Adrenaline Surge:**
   When player HP drops below 50%, damage increases dynamically up to +35% scaled inversely with remaining HP.
3. **Tactician Fortification:**
   When holding position or moving under 30 px/s, armor absorbs additional damage and weapon coverage widens.
4. **Commander Swarm Resonance:**
   Active summons, orbiting shields/blades, and follower units deal boosted damage.
5. **Elementalist Beat Discharge:**
   Attacks timed accurately to the music beat propagate status afflictions to neighboring enemies.
6. **Saboteur Executioner:**
   First strikes or attacks launched out of dash/stealth gain elevated critical strike multipliers.

---

## 4. Roster Registration Checklist

When introducing a new character to `src/game/data/characters.ts`:
1. Assign distinct visual palette, rig type, handle, and lore bio.
2. Define base signature weapon and ultimate ability.
3. Choose one `CharacterArchetype` and define `passiveAbility`:
   - `id`: unique kebab-case identifier.
   - `name`: evocative tactical ability title.
   - `archetype`: one of the 7 official archetypes.
   - `description`: gameplay narrative describing the ability in action.
   - `trigger`: mechanism activating the trait.
   - `effectSummary`: concise stat & mechanic readout for UI display.
   - `statModifiers`: calibrated stat modifications.
4. Ensure the character is registered in `CHARACTERS` and UI selectors reflect the passive card.
