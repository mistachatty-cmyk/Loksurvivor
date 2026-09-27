# LOK Universe Exchange

## What this is

616 Survivor can now send and receive collectible cards with other G-Six
games (starting with Spend It All's LOKdex) through a shared, game-agnostic
JSON contract: `lok.card-exchange`. See Spend It All's
`docs/LOK_CARD_EXCHANGE_PROTOCOL.md` for the full protocol this implements —
this file only records the decisions specific to *this* game's side of it.

## Why a kennel companion never becomes the transferred object directly

`SavedLokPet.roll.stats` feeds real combat numbers into a run
(`startingLokPets` in `RunScreen.tsx`). Nothing on the receiving side of an
import can validate another game's numbers for balance, and nothing on our
side should hand out real combat stats for another game to interpret however
it likes. So:

- **Export** (`src/lib/lokCardExchange.ts`, `exportLokPetAsPortableCard`)
  strips a `SavedLokPet` down to flavor only — name, family, silhouette id,
  rarity label, description. `LokPetRoll.stats`/`attackKind`/`element` never
  leave this game.
- **Import** produces a `VisitingLokCard` (see the type's doc comment in
  `types.ts`), a new, deliberately separate field on `MetaState`
  (`meta.visitingLokCards`) from `savedLokPets`. It is never converted into a
  `SavedLokPet`, can never be selected for a run, and never grants a
  companion/advisor role. It exists purely as an Archive record.

## Why a visiting card always renders as the same fixed silhouette

Per `survivor-616-art-assets.md`, only this game's own procedural rig may
ever represent a character on screen. A visiting card's manifest is
untrusted foreign data, so nothing in it should ever pick which local
silhouette/rig renders — `VISITING_CARD_SILHOUETTE`/`VISITING_CARD_PALETTE`
in `lokCardExchange.ts` are fixed constants (the `spark`/mote silhouette,
neutral blue-gray), used for every visiting card regardless of source game.
It reads as "an incoming signal," never a guess at the sender's actual art.

## Where it lives

- `src/lib/lokCardExchange.ts` — self-contained protocol implementation
  (export/import/serialize). Deliberately has no dependency on the Spend It
  All repo or a shared package; the contract is JSON, so this is 616
  Survivor's own independent copy of it, per the protocol doc's design goal.
- `game/state/metaStore.tsx` — `visitingLokCards` default/normalize
  (`normalizeVisitingLokCards`, capped at 120 entries), the
  `importVisitingLokCard` reducer action/hook.
- `ui/ArchivePanel.tsx` — the "Universe" chapter: export a kennel companion,
  paste in a card from elsewhere, browse visiting cards.
- `e2e/universe-exchange.spec.ts` — covers export (and that combat stats
  never leak into the exported JSON), import, and the own-namespace
  rejection guard.
