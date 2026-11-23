# Unified rooms plan: one universe, three rooms, one public hall

Status: PLAN ONLY (2026-11-23, from Eric's direction). Nothing here is built yet. Source of the Queens N Kings side: `Loks-Queens-N-Kings/docs/57-BEDROOM-AND-DOOR-TOGGLE.md`, `54-GRAND-HALL-ARCHITECTURE-MASTERPLAN.md`, `175-ROOM-LOOK-TILT-AND-FULL-REBUILD.md`, and `apps/v2/lobby/*`.

## What Eric wants
1. In 616 the menu should become a room: every menu item is a thing you walk up to and click in a bedroom, the way it works in Queens N Kings.
2. Copy as much as possible from Queens N Kings, in a planned and structured way (not a one-off port).
3. In time the rooms become the same rooms. A player has a **Survivor 616 room**, a **Queens N Kings room** and a **general Lok room**. Each keeps its own style.
4. Friends can join your room. Each game has its own lobbies, and each can leave to a **shared, combined public hall**. Survivor 616 gets a special hall of its own too.
5. The style clash (616 is neon street grit, Queens N Kings is castle pixel gold) is the hard part. Solve it with shared structure and swappable style, not by forcing one look.

## Where each game is today

| | Survivor 616 | Queens N Kings |
| --- | --- | --- |
| Home | The hideout strip: a side-on walk-along strip of rooms (`HUB_ROOMS` in `data/progression.ts`: The Sanctum, The Perch, The Cellar, The Alley Annex). Menu items are `HubPanel` buttons (`features` per room) plus walkable props (`data/hideoutProps.ts`). | A 12 by 12 tile top-down **bedroom** (`lobby/bedroomLayout.ts`, `bedroom.ts`), a wall switch for online and offline, an arcade cabinet, a door to the Grand Hall. |
| Pixel contract | Canvas2D, procedural props (`ui/hideoutPropArt.ts`) | Single-source layout, whole pixels, validator plus reachability test, procedural art plus SVG sprites |
| Public space | None | Grand Hall (`lobby/hallLayout.ts`, `publicHall.ts`), four-player rooms, door toggle |
| Social | Friends and crew (`LOK_FRIENDS.md`), invite links and QR | Same invite pipeline (`?go=hall.CODE`, `?go=room.CODE`) |
| Look | One look | Style choices (`roomStyle.ts`), flat or tilted (`roomLook.ts`) |

Shared already: the invite grammar (`https://<host>/?go=<kind>.<CODE>`, kinds friend, crew, room, match, four, hall, watch), the Lok glyph icon set and its design standard, the crew-link backend, the emoji-free rule.

## The design: separate the three things that clash

Rooms clash because three things are welded together. Split them:

1. **Layout** (where things are). Data only: a grid, zones, furniture slots, doors, interaction points. Style-free.
2. **Content** (what things do). Each interaction point is a typed action: open a screen, enter a door, play a minigame, claim a payout. Style-free.
3. **Skin** (how it looks). A skin draws a layout: tiles, furniture sprites, lighting, palette, props. Swappable per game and per player.

A room is `layout + content + skin`. Today Queens N Kings welds all three in `bedroom.ts` (1,079 lines) and 616 welds them in `HubScreen.tsx` and `hideoutPropArt.ts`.

### Shared package: `lib/lok-rooms` (new, in Lok-EcoSystsem, vendored like the invite SDK)
Vendored the same way as `lok-universe`: edit in `Lok-EcoSystsem/universe-sdk`, run `sync-sdk.sh`, never edit the vendored copy.

- `layout.ts`: `RoomLayout` type (cols, rows, tile size, zones, `Anchor[]`), validator, reachability check. Lift this from Queens N Kings `bedroomLayout.ts` and its tests, which already have negative tests.
- `actions.ts`: `RoomAction` union: `openPanel(panelId)`, `door(targetRoomId)`, `launch(gameId, mode)`, `toggle(settingId)`, `claim(propId)`, `emote`. The id strings are the existing 616 `HubPanel` names and Queens N Kings destinations, so nothing is renamed.
- `skin.ts`: `RoomSkin` interface (`drawFloor`, `drawWall`, `drawAnchor(kind, state)`, `palette`, `lightingPass`). Pure canvas, no game imports.
- `walk.ts`: avatar movement, collision and Y-sorting (from `lobby/lobbyEngine.ts`), with pixel snapping.
- `presence.ts`: room presence over the existing Supabase channel: who is in which room, position, emote. Replaces the two per-game sync paths (`bedroomSync.ts` and 616's friends presence).

### Room types
| Room | Owner | Skin | Purpose |
| --- | --- | --- | --- |
| `room.616` | per player | 616 skin (neon, brick, grit) | Run select, roster, allies, shop, bestiary, vendor, workshop, recovery, settings |
| `room.qnk` | per player | Queens N Kings skin (stone, gold, banners) | Campaign, arcade, wardrobe, shop, trophy room |
| `room.lok` | per player | neutral Lok skin | Account, Lok Pass, friends and crew, cross-game collection, achievements |
| `hall.616` | game | 616 skin | Public 616 lobby: crews, co-op matches, leaderboards |
| `hall.qnk` | game | Queens N Kings skin | Existing Grand Hall |
| `hall.lok` | universe | neutral skin plus per-game doorways | Shared combined lobby; doors lead to each game's hall and to your friends' rooms |

Every room has a **door ring**: the same three doors in the same place (home room, game hall, Lok hall) so players learn it once. Rooms link by id (`door(hall.lok)`), never by game-specific code.

### The style clash: how it is handled
- **Skins are first class.** The Lok hall draws each visitor's avatar and each doorway in that game's skin, so the room is a collage on purpose: a neon door beside a castle door. Consistency comes from shared scale (same tile size, same avatar scale, same pixel snapping), shared lighting rules (one warm ambient plus per-skin accent) and shared glyphs, not from sharing colours.
- **Shared frame.** The same wall switch, the same door plaque design (colour never alone, always a word), the same prompt chip, the same notices. Players read the frame before the skin.
- **Per-player choice.** A player picks a skin per room, like Queens N Kings `roomStyle.ts`. New skins are a record plus draw functions, not a new room.
- **No raw art.** Skins use procedural drawing and Lok glyphs only, per the design standard.

### Menu to room mapping (616)
Every `HubPanel` becomes an anchor. Starting map for `room.616`:

| Menu item (`HubPanel`) | Room object |
| --- | --- |
| runs | Map table in the middle of the room |
| roster, locker, studio | Wardrobe and mirror |
| allies | The rescued survivors themselves, standing around; tap one to open their card |
| bestiary | Bookshelf with the Threat Matrix screen |
| music, sound-booth | Jukebox and turntable |
| lok-shop, palette-store, card-shop | Shop counter, poster wall |
| vendor, workshop | Workbench |
| kennel | Pet bed |
| recovery | Medic cot |
| settings | Wall panel next to the door |
| unlocks | Trophy shelf |
| grpd-armory, weapon-bans | Weapon rack |

Rescued survivors already live in rooms (`HUB_ROOMS`, `AllyDef.room`, hideout crew life). In the unified room they are real avatars with the same walk rules; this is the natural bridge between the lore (held in digitization relays, then freed) and the room (they stand in your room once you free them).

## Phases
Each phase ships on its own and leaves both games working.

1. **Lift the contract (no visible change).** Move `RoomLayout`, validator, reachability test and `RoomAction` into `lib/lok-rooms`. Queens N Kings bedroom adopts it with tests passing unchanged. 616 gets the types only.
2. **Skin interface.** Split `bedroom.ts` drawing into a Queens N Kings skin; keep behaviour identical. Add a neutral skin for tests.
3. **616 bedroom, read-only.** Build `room.616` layout with the table above, 616 skin using `hideoutPropArt` pieces. The old menu stays; the room is an opt-in toggle ("Room view") like Queens N Kings' flat or tilt switch. Every anchor calls the existing panel opener, so no screen is rewritten.
4. **Room as default**, menu becomes the fallback (accessibility, low power, reduced motion). Keep `MenuDock` for those players.
5. **Shared presence.** `lib/lok-rooms/presence.ts` replaces both per-game sync paths. Friends can walk into your room via the existing `?go=room.CODE` link.
6. **Lok room and Lok hall.** Neutral skin, doors to both game halls. First cross-game content: shared collection shelf and achievements wall.
7. **616 public hall** (`hall.616`): crew lobby, co-op match door, leaderboard board. Then link all three halls through `hall.lok`.
8. **Skin pass.** Player-selectable skins, seasonal skins, event skins.

## Risks and rules
- Do not silently change tile sizes; Queens N Kings documents a migration rule for this (docs 54). The shared tile is whatever Queens N Kings uses today, and 616 skins draw to that grid.
- Hash-locked files in Queens N Kings (`lobby/peon.ts` and the Grand Hall tests) change only on purpose, with the hash test updated in the same commit.
- Every payout from a room object goes through `engine/hideoutRewards.ts` (616) or its Queens N Kings equivalent. Rooms never write the save.
- Performance: Queens N Kings tilt is a WebGL layer; 616 is Canvas2D only. Keep tilt optional and off in Battery saver.
- Naming: Queens N Kings bans the letters of "lock" in code; 616 bans "signal". The shared package avoids both.
- Privacy: rooms are private to the owner until a link is made; presence only broadcasts to people in the room.

## Backend needed (noted for later)
Room presence at scale, room ownership and visitor lists, public hall instances and capacity, moderation and reporting, cross-game inventory, friends-only versus link-only rooms, server-checked and expiring room links.

## Open questions for Eric
- Which game owns the avatar? One shared Lok avatar (Peon from Queens N Kings, or a 616 survivor) or one per game with a switch?
- Should `hall.lok` show other people's skins as they are, or normalise avatars to one style?
- Is the 616 room top-down like the Queens N Kings bedroom, or kept side-on like the hideout strip?

## Status (v0.42.74)

Built in 616: shared rooms contract (SDK 1.8.0), `rooms616.ts` layouts, `roomSkins.ts`, `RoomScreen.tsx` (walk, tap-to-walk, use button), `RoomWorld.tsx` (bedroom and Lok hall, lever, Queens N Kings doorway), and a "Your room" button in the hideout. The selected character is the avatar. 616 has no public hall, so the bedroom door always leads to the Lok hall.

Still to do: Queens N Kings adopts the vendored `rooms.ts` and wires its bedroom lever and Lok hall door (see its TODO); furniture art pass; shared presence in the Lok hall (needs a backend).

### v0.42.75 additions

Live status on objects (`roomStatus.ts`: counts and a daily-stash alert), 616 skyline and furniture art, and a `?hall=lok` link that lands in the Lok hall. Queens N Kings reuses its existing bedroom door setting: a third choice, "Lok hall", opens `survivor.gsix.online/?hall=lok` (route in `apps/v2/lobby/hallRoute.ts`). Moving the hall itself into a shared module, so both games render the same room in place, is the next step.
