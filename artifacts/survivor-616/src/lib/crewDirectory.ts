/**
 * 616's rows in the shared Lok Game Directory (Crew Link). The Crew Hub reads this table: multiplayer modes
 * show on top, offline ones in a scroll underneath. Add a row here when a mode should be offered to a crew.
 * Routes are the `?screen=` names App.tsx already understands.
 */

import { createGameDirectory, type DirectoryRow } from '../../../../lib/lok-universe/src/gameDirectory';

const APP = 'survivor-616';

export const SURVIVOR_DIRECTORY_ROWS: DirectoryRow[] = [
  { id: 'party.board', app: 'party', name: 'Lok Party', modeName: 'Board game', glyph: 'party-board', kind: 'online', minPlayers: 2, maxPlayers: 4, invite: 'room', route: '?screen=lok-party', minSdk: '1.11.0' },
  { id: 'party.couch', app: 'party', name: 'Lok Party', modeName: 'Couch play', glyph: 'party-couch', kind: 'local', minPlayers: 2, maxPlayers: 4, invite: null, route: '?screen=lok-party', minSdk: '1.11.0' },
  { id: 'survivor.areas', app: 'survivor', name: '616 Survivor', modeName: 'Runs', glyph: 'survivor-run', kind: 'offline', minPlayers: 1, maxPlayers: 1, invite: null, route: '?screen=areas', minSdk: '1.11.0' },
  { id: 'survivor.hideout', app: 'survivor', name: '616 Survivor', modeName: 'Hideout', glyph: 'survivor-hideout', kind: 'offline', minPlayers: 1, maxPlayers: 1, invite: null, route: '?screen=hub', minSdk: '1.11.0' },
];

export const GAME_DIRECTORY = createGameDirectory(SURVIVOR_DIRECTORY_ROWS);
export const DIRECTORY_APP = APP;
