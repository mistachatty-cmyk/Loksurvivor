# LokPets

> **Update (v0.11.0).** This file describes the original *run* behavior of chest
> LokPets. Since then LokPets became a collectible kennel: pets you catch are
> saved (`SavedLokPet`), level up (cap 50, or 99 for your starter partner), evolve,
> fight in the arena and the Sanctum League (8 tiers), and build **bond** with you,
> which unlocks five name slots. The starter partner is always with you. See
> `docs/lokpet-creature-design.md` and `docs/lokpet-rpg-and-digi-tower-plan.md`.
> The temporary-lifecycle section below still describes how a pet behaves inside a run.

LokPets are deterministic, temporary chest companions. A chest rolls one
visual variant and one combat stat sheet independently, so the same silhouette
can appear with different combat traits from run to run.

## Variant sheet

The visual sheet uses compact vector silhouettes rather than external or
supplied character art:

- **Pouncer** — animal-like ears and a springing tail
- **Ghoul** — rounded skull and hollow eyes
- **Winglet** — small bat-like spread wings
- **Mote** — floating eight-point pulse spark
- **Blob** — soft jelly profile
- **Clockwork** — faceted little machine

Each family has multiple original palettes. The palette is cosmetic and never
changes the generated combat numbers.

## Generated stat sheet

Each chest roll includes:

- rarity, health, move speed, damage, range, projectile speed
- attack cadence and lifetime
- explosion and pulse radius where relevant
- one attack mode: single shot, rapid fire, heavy shot, pulsating field, or
  burst explosion
- one elemental trait: kinetic, fire, Freeze, or slow

The generator is seeded from the run RNG. Rarity weights and bounded jitter
keep common companions useful without allowing an unusually lucky roll to
break the combat curve. Pulse rolls prefer Freeze/slow control; explosion
rolls prefer fire, keeping the visual and gameplay read clean.

## Temporary lifecycle

A run can show at most four LokPets for mobile readability. A newly generated
pet replaces the oldest active pet at the cap. Pets follow the player on
separate orbit paths and use the existing projectile, area-damage, status, and
particle systems.

The first 60 seconds are the active phase. The pet then becomes a transparent
spectral version, emits a transition burst, and continues following and using
its rolled ability until its 90–108 second lifetime expires. Expired pets are
removed from combat but remain in the run history so the reward and summary
surfaces can report what was generated.

Supplied reference sheets are inspiration only; they are never rendered
directly.