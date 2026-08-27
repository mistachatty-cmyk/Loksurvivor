# 616 Survivor — Character Reference Guide

This is a creative moodboard, not a request to reproduce the supplied artwork.
The game should keep its existing cast recognizable while borrowing broad ideas
about silhouette, palette, motion, and atmosphere. New silhouettes, names,
abilities, and pixel constructions must remain original.

## Supplied references

| Asset | Visual read | 616 Survivor direction |
| --- | --- | --- |
| `attached_assets/IMG_9340_1787696127871.jpeg` | Iridescent, star-lit figure; prismatic robe energy and sharp starbursts. | A limited-palette light caster with color-shifting trims, radiating hit sparks, and an attack that feels like a folded prism opening. |
| `attached_assets/IMG_9341_1787696127871.jpeg` | Neon flame-headed dark silhouette. | A readable charcoal body with a hot flame crown; the flame should wag, flare on attack, and gutter during hurt/death frames. |
| `attached_assets/IMG_9342_1787696127870.jpeg` | Black cat-like shadow with glowing spiral eyes. | A low, strange shadow threat with spiral eye marks and a corkscrew projectile telegraph; do not copy the source creature. |
| `attached_assets/IMG_9343_1787696127871.jpeg` | Cosmic ring/planet hat over a dark figure. | Orbital geometry, crescent effects, and a top-heavy silhouette for an astral survivor or enemy. |
| `attached_assets/B8A21971-3CC1-496C-A4CA-5CF02CFA9AC2_1787696183312.gif` | Deep blue-green animated figure with cyan/blue energy accents. | River-night colors, cyan pulses, trailing motes, and a current-like movement rhythm. Preserve the loop's calm-to-bright energy escalation rather than tracing frames. |
| `attached_assets/2C22C8CD-53FB-4652-8DE5-B0B2FC9C3454_1787696212217.gif` | Magenta/crimson armored brute with horn-like shoulders, claws, and smoky aura. | An original elite silhouette with broad shoulder pixels, magenta smoke, and heavy anticipation before a charge. |
| `attached_assets/3E4EDBC0-A23B-46B5-85D5-1503C864B74C.gif` | Slender teal/indigo river spirit with branch-like antlers, a trailing lower form, and floating motes. | An agile current enemy with teal motes and a branching crest; keep the body abstract and pixel-readable. |
| `attached_assets/2744F920-0701-4FA8-B367-0EA2A258656B.gif` | Compact gold/cream astral caster with violet-blue aura, ring orbs, and crescent hand effects. | A small gold/violet orbital caster with ring-shaped spell feedback and a clear wind-up/release cadence. |

## Pixel languages to keep exploring

- **Limited-palette spritework:** hard ink outlines, 4–7 meaningful colors,
  stepped diagonals, and a silhouette that reads at run scale.
- **Effect-led silhouettes:** let glow, motes, flame, or smoke carry personality,
  but keep the core body legible when effects overlap.
- **Odd anatomy:** asymmetry, floating lower bodies, oversized hands, and
  impossible headwear are welcome when collision remains fair.
- **Retro motion:** idle should reveal personality; walk should have a rhythm;
  attack needs anticipation, a readable release frame, and follow-through; hit
  and defeat should not be the same pose.

## Animation brief

Every new rig should have a visible idle, walk, attack, hurt, and death
language. Ability effects should echo the silhouette's motif: prismatic
starbursts, flame arcs, spiral shadows, cyan current motes, magenta smoke, or
violet-gold orbiting rings. Rendering uses original rectangle-based sprite rigs;
the references are never loaded as character sprites.

## Boundaries

Do not pixel-trace, crop, or ship the source figures as game characters. Do not
reuse distinctive names, logos, or exact costume details. Use the references to
choose a mood and motion vocabulary, then make a new Grand Rapids night
character with its own story, palette relationships, combat role, and readable
animation.

## Next-generation roster

The current expansion deliberately uses ten different gameplay silhouettes
rather than ten costume swaps:

| Survivor | Silhouette language | Signature model | Pacing / status |
| --- | --- | --- | --- |
| Triangle Saint | angular warning-sign body with a crown point | three delayed wedge waves | measured control; Slow |
| Mile Marker | tall signpost courier with staff/ruler | straight lane laser | deliberate precision |
| Emberback | broad quadruped furnace | persistent fire ring | slow, durable area denial; Burning |
| The Horse You | oversized mascot with giant hands | comic-book punch impact | very slow wind-up, huge knockback |
| Glass Eel | long translucent ribbon | blink strike | extremely fast reposition; Freeze |
| Acid Botanist | river-green gardener with branching crest | corrosive planted garden | patient space control; Acid |
| Allymaker | prismatic matchmaker | temporary enemy conversion beat | mobile support/control |
| Orbit Whale | wide floating whale/blob | staged gravitational breach | slow, wide crowd shaping |
| Blink Choir | spiral hood with multiple mask marks | repeated teleport attack | frantic hit-and-run; Slow |
| Punchline | compact caped comedian | delayed punch detonation | burst timing and anticipation |

All ten use original rectangle-built rigs and independent palettes. Their
weapons are records in the shared catalog: `wave`, `laser`, `hazard`,
`teleport`, `convert`, and `punch` are reusable behavior families, not
character-specific branches. Fire and acid fields remain visible, expire, tick
damage, and can hurt the survivor as well as enemies, making placement a real
tradeoff.

## Ability preview and tactical vocabulary

The roster uses one reusable field-preview standard for every survivor:
the selected rig advances in a walking loop, a compact attack window shows
the weapon's cadence and target response, and a second window shows the
ultimate's anticipation, release, persistence, and expiry language. The
preview is intentionally schematic so it stays readable on a phone and never
depends on a character-specific UI branch.

Followers are capped, owned by their weapon record, and communicate their
role through size and timing. A tiny permanent orbit group stays fast and
legible; Allymaker's temporary followers begin small, grow after a delay, seek
targets, attack on their own cadence, and dissolve with particles.

Enemy factions are built from palette, body plan, role, and movement rhythm:
the Afterimage Choir uses flanks, short teleports, and ghost windows; the
Cinder Procession uses heavy anchors, size shifts, and burst charges; the
River Antler Court uses current pushes, repositioning, and ranged support.
Formation records use rings, wedges, walls, escorts, pincers, staggered files,
and bait groups. Their positions are seeded from the run RNG, so a replay
does not become a different encounter.

Originality boundary: these names, silhouettes, effects, and formation
relationships are authored for 616 Survivor. Supplied references remain a
moodboard for broad color and motion only; no source figure, logo, costume,
name, or frame is copied into the game.