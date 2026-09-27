# Legendary roster update — 2026-09-09

This update is a playable procedural-rig expansion, not a concept-art import. Keep the identities below stable: future balance or polish may change numbers, but must not silently replace a silhouette, palette, weapon pattern, pet ability, or named trait.

## Playable characters

| Character | Locked silhouette | Signature weapon pattern |
| --- | --- | --- |
| Bellwright | Tall keeper with a colossal shoulder bell | Resonance bolts reflect, then reverse |
| Mawheel | Hunched torso fused to one huge lower wheel | Forward charge with a damaging spark wake |
| Lantern Widow | Thin cloak with six lantern-hook arms | Links up to six targets into one damage network |
| Brassback | Short, broad brass boiler and chimney | Harpoon pulls a target, then vents a burst |
| Paper Saint | Tall, flat folded body with angular wings | Piercing folding blades plus decoys |
| Eclipse Pilgrim | Crescent cloak beneath a floating black sun | Persistent gravity well pulls and damages |
| Bloomheart | Wide flower body, antlers, visible crystal heart | Connected healing roots trap, then burst |
| Marionette King | Crowned puppet beneath a giant spectral hand | Commands several enemies to change allegiance |
| Cryo-Mantis | Tall insect body with four scythe arms | Two crossed absolute-zero cuts freeze targets |
| Neon Leviathan | Serpentine whale head, fins, luminous spine | Spectral wave replays the player's recent route |

All ten are `rarity: 'legendary'`, use a procedural `SpriteRig`, expose exactly two `signatureTraits`, have a unique `legendaryPattern`, and render with their palette glow. The first five characters' palettes are preview palettes; do not treat palette tuning as permission to redesign them.

## Legendary LokPets

| Pet | Scale | Locked silhouette | Special ability |
| --- | ---: | --- | --- |
| Prism Moth | 0.68 | Tiny diamond body with oversized crystal wings | Pulls several pickups inward |
| Void Pup | 0.92 | Star-filled wolf with smoke paws | Teleports a distant reward and emits a slow pulse |
| Ember Koi | 1.28 | Large ribbon koi with oversized fins and flame tail | Heals and rescues an old missed pickup |
| Clockwork Beetle | 0.76 | Tiny six-legged beetle with clock-shell face | Pauses hazards and reduces weapon cooldowns |

Clockwork Beetle's clock face and both hands rotate continuously in the renderer. Their speed increases while its special ability is active. This motion is part of the design contract.

## Cheap, high-quality implementation rule

Prefer the existing Canvas2D procedural rig and effect vocabulary. New silhouettes should compose existing rig factories and a small number of pixel parts; new attacks should reuse projectiles, hazards, lasers, followers, trails, status effects, and conversion behavior. Do not add raw labeled sheets, video, large sprite atlases, or a second animation system for this roster.

## Optional follow-up polish

- Tune numbers after playtesting without changing identity contracts.
- Add bespoke audio cues by reusing the existing audio bus.
- Add progression unlock rules only after the launch roster has been tested as default-unlocked.
- Add focused VFX frames if profiling shows headroom; preserve the procedural fallback.

