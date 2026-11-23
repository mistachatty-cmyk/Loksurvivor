/**
 * The Survivor 616 bedroom and the universal hall, as data. Layout and content only (see the shared contract in
 * `lib/lok-universe/src/rooms.ts` and `docs/UNIFIED_ROOMS_PLAN.md`); the look lives in `ui/roomSkins.ts`.
 *
 * Every hideout menu item that the room covers is an anchor whose action is the same `HubPanel` the menu button
 * opens, so no screen is rewritten. Panels not listed here stay reachable from the menu view.
 */
import { LOK_HALL_LAYOUT, type RoomAnchor, type RoomLayout } from '../../../../../lib/lok-universe/src/rooms';

const panel = (id: string, kind: string, col: number, row: number, w: number, h: number, p: string): RoomAnchor =>
  ({ id, kind, col, row, w, h, action: { type: 'panel', panel: p } });

export const BEDROOM_616: RoomLayout = {
  id: 'room.616',
  cols: 17,
  rows: 12,
  tile: 48,
  start: { col: 8, row: 8 },
  solids: [{ col: 0, row: 0, w: 17, h: 2 }],
  anchors: [
    // Wall row: things hung or shelved against the back wall.
    panel('roster', 'wardrobe', 1, 2, 2, 1, 'roster'),
    panel('studio', 'mirror', 3, 2, 1, 1, 'studio'),
    panel('locker', 'locker', 4, 2, 1, 1, 'locker'),
    panel('feedback', 'noticeboard', 5, 2, 1, 1, 'feedback'),
    panel('bestiary', 'shelf', 6, 2, 2, 1, 'bestiary'),
    panel('palette-store', 'posters', 8, 2, 1, 1, 'palette-store'),
    panel('threat-matrix', 'screen', 9, 2, 2, 1, 'threat-matrix'),
    panel('card-shop', 'posters', 11, 2, 1, 1, 'card-shop'),
    panel('unlocks', 'trophies', 12, 2, 2, 1, 'unlocks'),
    panel('music', 'jukebox', 14, 2, 2, 1, 'music'),
    panel('sound-booth', 'booth', 16, 2, 1, 2, 'sound-booth'),
    // Floor: the middle of the room is the map table.
    panel('runs', 'table', 6, 5, 4, 2, 'runs'),
    panel('lok-shop', 'counter', 1, 5, 1, 3, 'lok-shop'),
    panel('kennel', 'petbed', 1, 10, 2, 1, 'kennel'),
    panel('vendor', 'workbench', 4, 10, 2, 1, 'vendor'),
    panel('workshop', 'workbench', 6, 10, 2, 1, 'workshop'),
    panel('grpd-armory', 'rack', 9, 10, 2, 1, 'grpd-armory'),
    panel('weapon-bans', 'rack', 11, 10, 2, 1, 'weapon-bans'),
    panel('recovery', 'cot', 13, 10, 2, 1, 'recovery'),
    panel('account', 'desk', 13, 6, 2, 1, 'account'),
    // Right wall: settings panel, the hall lever, and the door out.
    panel('settings', 'wallpanel', 16, 5, 1, 1, 'settings'),
    { id: 'stash', kind: 'stash', col: 11, row: 7, w: 1, h: 1, action: { type: 'note', key: 'room.note.stash' } },
    { id: 'lever', kind: 'lever', col: 16, row: 7, w: 1, h: 1, action: { type: 'lever' } },
    { id: 'door', kind: 'door', col: 16, row: 8, w: 1, h: 2, action: { type: 'door', to: 'hall.lok' } },
  ],
};

/** Hub panels that the bedroom covers. A test keeps this honest against the anchors. */
export const BEDROOM_PANELS = BEDROOM_616.anchors.flatMap((a) => (a.action.type === 'panel' ? [a.action.panel] : []));

export const UNIVERSAL_HALL: RoomLayout = LOK_HALL_LAYOUT;
