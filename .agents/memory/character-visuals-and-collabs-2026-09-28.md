---
name: Character visual expansion and a collab-character design (unbuilt)
description: What "collabs" can safely mean under this game's no-bitmap/no-fabricated-licensing rules, the rig-vocabulary options added toward it, and the attribution scaffold to add once a real partner exists.
---

## What exists today

Every playable character/ally/enemy likeness is a procedural rig
(`sprites/rigs.ts`: `humanoidRig`/`quadrupedRig`/`blobRig`/etc. -- see
`content-authoring-system.md`) rendered as flat-color rectangles via
`render/sprite.ts`'s `drawRig`, never a bitmap. `data/characterSkins.ts` is
the entire "visual customization" surface today, and it only remixes the
**palette** (4 base colors -> `nocturne`/`countertone`/`episode` variants)
-- it never changes silhouette. So two different characters read as visually
distinct today almost entirely through the `HumanoidOptions` a character
picks (`bulk`/`hunched`/`hood`/`cap`/`wings`/`cloudHair`/`flarePants`/etc.)
plus color.

## The hard constraints a "collab" has to respect

From `survivor-616-art-assets.md`: the user's own reference art can never be
shown raw in a UI card (working sheets have baked-in labels), and the game
must never fabricate real artist/licensing claims. Combined with `CLAUDE.md`'s
"100% Canvas2D, no sprite sheets, no bitmaps in the render path" rule, this
rules out the obvious approach (import a guest artist's actual character
sheet as a portrait/sprite). **A collab character has to be built the same
way every other character is: as a procedural rig**, not as licensed art
dropped in. That's a real constraint on what a "collab" can look like, not
just a technical preference -- it also means there is no ambiguity later
about whose art is on screen.

## What was added this pass: three new silhouette options

`HumanoidOptions` (`sprites/rigs.ts`) gained `visor`, `cape`, and
`chestEmblem` -- all additive, all optional, zero effect on any existing
character (nothing was migrated to use them). They exist because the
current vocabulary (hood/cap/puffs/halo/staff/wings/cloudHair/flarePants)
skews toward "original 616 street character" silhouettes and is missing a
few of the most common recognizable cues a guest/crossover design is likely
to lean on:

- `visor` -- a wide accent-colored band replacing the default face stripe.
  Masked/visored heroes are extremely common in exactly the kind of
  character a collab partner would bring.
- `cape` -- a drape behind the torso (pushed before the leg/torso block so
  it renders behind, not layered as a cloak on top). Distinct from `wings`,
  which are symmetrical glow auras at the sides.
- `chestEmblem` -- a small accent-colored square centered on the torso, for
  a logo/emblem silhouette independent of the body/accent color choice.

These are useful for *any* new original character too, not just a collab
one -- they widen the general silhouette vocabulary. Nothing else needed to
change: `getCharacterSkins`'s palette remix, `palette()` in
`data/authoring.ts`, and the rest of the character-authoring pipeline all
work unchanged with any `HumanoidOptions` combination.

## What a real collab character would still need (not built -- no partner exists yet)

This is deliberately left as a design sketch, not code, because building it
now would mean inventing a fake partner to justify the abstraction --
exactly the kind of speculative building `CLAUDE.md` warns against. When an
actual collaboration is agreed:

1. **The character itself is just a `CharacterDef`** (`types.ts`) built from
   `humanoidRig`/`palette()` like any other roster entry -- no new type
   needed there. Follow the existing "Adding a character, checklist" flow
   in `CLAUDE.md`.
2. **Attribution metadata does not exist on `CharacterDef` today and needs
   its own small addition**, following the exact pattern
   `soundtrack-artist-links.md` already established for cross-promoting a
   real person (`trackCredits`/`albumCredits`, keyed like
   `favoriteFingerprints`): a `COLLAB_CREDITS_BY_CHARACTER_ID: Record<string,
   CollabCreditDef>` in a new `data/collabConsent.ts`/similar, *not* a field
   added to `CharacterDef` itself, so an un-collabed character carries zero
   extra shape. Sketch:
   ```ts
   interface CollabCreditDef {
     partnerName: string;
     partnerLink?: string;      // their site/socials, real and theirs
     creditLabel: string;       // shown in-game, e.g. "Design: <name>"
     consentNote: string;       // internal-only: how/when consent was given
   }
   ```
3. **Consent comes first, every time.** Per the art-assets memory's standing
   rule, never invent a real person's name, likeness, or endorsement. A
   `CollabCreditDef` entry should only ever be added after the named partner
   has actually agreed -- `consentNote` exists specifically so that's
   recorded and checkable later, not assumed.
4. **No raw art, ever, even "just as reference."** A collab partner may hand
   over their own character sheet/art for reference the same way the user's
   own supplied sheets are used -- fine to keep in `public/art/` as a private
   authoring reference, but it follows the exact same rule as the user's own
   sheets: never rendered raw in a card/panel, rig only.

## Other things worth improving, noticed while in this area

- **`data/characterSkins.ts`'s four styles are palette-only.** A natural
  next step (separate from collabs) would be letting a skin also toggle a
  *subset* of `HumanoidOptions` (e.g. an alternate silhouette skin, not just
  recolor) -- not attempted here, flagging since the new options above make
  it a slightly bigger design space than before.
- **`RigPortrait`/`HideoutPreview` both key their baked-frame cache off
  object identity** (`getBakedFrame`'s `WeakMap<rig, WeakMap<palette, ...>>`
  in `render/sprite.ts`). Fixed one real instance of this being silently
  defeated: `HubScreen.tsx`'s `selectedCharacterPalette` was recomputed
  fresh on every render (unmemoized `resolveCharacterCosmeticPalette` call),
  which tore down and rebuilt `HideoutPreview`'s canvas effect on every
  unrelated re-render (e.g. the 15s generator-income poll). Now wrapped in
  `useMemo`. Worth grepping for the same unmemoized-palette pattern
  elsewhere if a similar canvas-teardown symptom shows up again.
