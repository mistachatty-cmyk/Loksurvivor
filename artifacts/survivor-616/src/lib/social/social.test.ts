import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LokCrewState, LokFriend } from '@workspace/lok-client';

import { crewmateIds, invitable, isLeader, MAX_CREW_SIZE, onlineCount, slotsLeft, sortFriends } from './crewRules';
import { friendCodeFromSearch, friendShareUrl, normalizeFriendCode } from './friendCode';
import { avatarFor, displayNameFor, initialsOf, safeAvatarUrl } from './identity';

const friend = (userId: string, name: string, extra: Partial<LokFriend> = {}): LokFriend => ({ userId, name, avatar: null, showOnline: true, status: 'accepted', incoming: false, ...extra });
const member = (userId: string, name = userId) => ({ userId, name, avatar: null, showOnline: true });

test('friend codes read back from sloppy typing and reject anything else', () => {
  assert.equal(normalizeFriendCode('lok-7k2m-q9xd'), 'LOK-7K2M-Q9XD');
  assert.equal(normalizeFriendCode(' LOK 7K2M Q9XD '), 'LOK-7K2M-Q9XD');
  assert.equal(normalizeFriendCode('7K2MQ9XD'), 'LOK-7K2M-Q9XD');
  assert.equal(normalizeFriendCode('LOK-7K2M-Q9X'), null);
  assert.equal(normalizeFriendCode('LOK-0000-1111'), null, 'the lookalike characters are not in the alphabet');
  assert.equal(normalizeFriendCode(''), null);
});

test('the share link carries the code and reads back from the address', () => {
  const url = friendShareUrl('LOK-7K2M-Q9XD');
  assert.equal(url, 'https://survivor.gsix.online/?friend=LOK-7K2M-Q9XD');
  assert.equal(friendCodeFromSearch(new URL(url).search), 'LOK-7K2M-Q9XD');
  assert.equal(friendCodeFromSearch('?friend=nope'), null);
  assert.equal(friendCodeFromSearch('?other=1'), null);
});

test('names come from the username first and pictures only from known hosts', () => {
  assert.equal(displayNameFor({ user_metadata: { user_name: 'iweu', full_name: 'Eric H' } }), 'iweu');
  assert.equal(displayNameFor({ user_metadata: { full_name: 'Eric Hartfield' } }), 'Eric Hartfield');
  assert.equal(displayNameFor({ email: 'eric@example.com' }), 'eric');
  assert.equal(displayNameFor({ user_metadata: { user_name: '<b>x</b>' } }), 'bx/b');
  assert.equal(displayNameFor(null), 'Player');
  assert.equal(safeAvatarUrl('https://cdn.discordapp.com/avatars/1/a.png'), 'https://cdn.discordapp.com/avatars/1/a.png');
  assert.equal(safeAvatarUrl('http://cdn.discordapp.com/a.png'), null);
  assert.equal(safeAvatarUrl('https://evil.example/pixel.png'), null);
  assert.equal(safeAvatarUrl('javascript:alert(1)'), null);
  assert.equal(avatarFor({ user_metadata: { picture: 'https://lh3.googleusercontent.com/a' } }), 'https://lh3.googleusercontent.com/a');
  assert.equal(initialsOf('Eric Hartfield'), 'EH');
  assert.equal(initialsOf('iweu'), 'IW');
});

test('a crew holds four, only accepted friends can be invited and a full crew invites nobody', () => {
  assert.equal(MAX_CREW_SIZE, 4);
  const friends = [friend('a', 'Ada'), friend('b', 'Bo'), friend('c', 'Cy', { status: 'pending', incoming: true }), friend('d', 'Di')];
  const solo: LokCrewState = { crew: { id: 'x', leaderId: 'me', game: 'survivor616' }, members: [member('me')], invites: [] };
  assert.deepEqual(invitable(friends, solo).map((f) => f.userId), ['a', 'b', 'd']);
  assert.equal(slotsLeft(solo), 3);
  const withA: LokCrewState = { ...solo, members: [member('me'), member('a')] };
  assert.deepEqual(invitable(friends, withA).map((f) => f.userId), ['b', 'd']);
  const full: LokCrewState = { ...solo, members: [member('me'), member('a'), member('b'), member('d')] };
  assert.deepEqual(invitable(friends, full), []);
  assert.equal(isLeader(solo, 'me'), true);
  assert.equal(isLeader(solo, 'a'), false);
  assert.deepEqual(crewmateIds(withA, 'me'), ['a']);
});

test('online friends sort first and a friend who hides their status never shows as online', () => {
  const friends = [friend('a', 'Ada'), friend('b', 'Bo'), friend('c', 'Cy', { showOnline: false })];
  const online = { b: { game: 'survivor616', doing: 'run' }, c: { game: 'survivor616', doing: 'menu' } };
  assert.deepEqual(sortFriends(friends, online).map((f) => f.userId), ['b', 'a', 'c']);
  assert.equal(onlineCount(friends, online), 1);
});

import { DRIFT_SEEK_SEC, followActions, hostChanged, parseListenMessage } from './listenSync';

test('listen messages from the network are checked and clamped', () => {
  assert.deepEqual(parseListenMessage({ kind: 'start', trackId: 'lokifed-1', positionSec: 12.5, playing: true, name: '<b>Ada</b>' }), { kind: 'start', trackId: 'lokifed-1', positionSec: 12.5, playing: true, name: 'bAda/b' });
  assert.equal(parseListenMessage({ kind: 'state' }), null, 'a state with no song means nothing');
  assert.equal(parseListenMessage({ kind: 'explode', trackId: 'x' }), null);
  assert.equal(parseListenMessage('hi'), null);
  assert.equal(parseListenMessage(null), null);
  assert.equal(parseListenMessage({ kind: 'state', trackId: 'x', positionSec: -5 })!.positionSec, 0);
  assert.equal(parseListenMessage({ kind: 'state', trackId: 'x', positionSec: 1e12 })!.positionSec, 21600);
  assert.equal(parseListenMessage({ kind: 'state', trackId: 'x', positionSec: Number.NaN })!.positionSec, undefined);
  assert.deepEqual(parseListenMessage({ kind: 'leave' }), { kind: 'leave' });
});

test('a follower switches songs, then play state, then position, and a heartbeat only corrects drift', () => {
  const host = { kind: 'state' as const, trackId: 'b', positionSec: 30, playing: true };
  assert.deepEqual(followActions(host, { trackId: 'a', positionSec: 5, playing: true }, true), [{ type: 'play-track', trackId: 'b', positionSec: 30 }]);
  assert.deepEqual(followActions({ ...host, playing: false }, { trackId: 'a', positionSec: 5, playing: true }, true), [{ type: 'play-track', trackId: 'b', positionSec: 30 }, { type: 'toggle' }]);
  assert.deepEqual(followActions(host, { trackId: 'b', positionSec: 30.4, playing: true }, true), [{ type: 'none' }]);
  assert.deepEqual(followActions(host, { trackId: 'b', positionSec: 10, playing: true }, false), [{ type: 'seek', positionSec: 30 }]);
  assert.deepEqual(followActions(host, { trackId: 'b', positionSec: 10, playing: false }, false), [{ type: 'none' }], 'a heartbeat does not restart a follower who paused');
  assert.deepEqual(followActions(host, { trackId: 'a', positionSec: 1, playing: true }, false), [{ type: 'none' }], 'a heartbeat does not change the song either');
  assert.deepEqual(followActions({ ...host, playing: false }, { trackId: 'b', positionSec: 30, playing: true }, true), [{ type: 'toggle' }]);
  assert.ok(DRIFT_SEEK_SEC > 0.5);
});

test('the host announces a new song, play or pause and a seek, but not the ordinary tick', () => {
  const base = { trackId: 'a', playing: true, positionSec: 10 };
  assert.equal(hostChanged(null, base), true);
  assert.equal(hostChanged(base, { ...base, positionSec: 11 }), false);
  assert.equal(hostChanged(base, { ...base, playing: false }), true);
  assert.equal(hostChanged(base, { ...base, trackId: 'b', positionSec: 0 }), true);
  assert.equal(hostChanged(base, { ...base, positionSec: 60 }), true);
});
