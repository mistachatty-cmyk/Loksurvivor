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

import { cleanChat, createChatLimiter, MAX_CHAT_LENGTH, parseCrewChat } from './crewChat';

test('chat lines are cleaned and capped', () => {
  assert.equal(cleanChat('  hi \n\n there\t!  '), 'hi there !');
  assert.equal(cleanChat('x'.repeat(500)).length, MAX_CHAT_LENGTH);
  assert.equal(cleanChat('   '), '');
});

test('incoming chat accepts only valid lines and known emotes', () => {
  assert.deepEqual(parseCrewChat({ kind: 'chat', text: ' gg ' }), { kind: 'chat', text: 'gg' });
  assert.deepEqual(parseCrewChat({ kind: 'emote', emote: 'wave' }), { kind: 'emote', emote: 'wave' });
  assert.equal(parseCrewChat({ kind: 'emote', emote: 'rm -rf' }), null);
  assert.equal(parseCrewChat({ kind: 'chat', text: 5 }), null);
  assert.equal(parseCrewChat({ kind: 'chat', text: '   ' }), null);
  assert.equal(parseCrewChat({}), null);
});

test('the chat limiter allows a short burst, then waits for the window to pass', () => {
  const limiter = createChatLimiter(3, 1000);
  assert.ok(limiter.allow(0) && limiter.allow(10) && limiter.allow(20));
  assert.ok(!limiter.allow(30));
  assert.ok(limiter.allow(1100));
});

import { crewRunLength, expireSeats, freeSeatId, heardFrom, openCrewRun, seatJoiner, seatLeaves, SEAT_TIMEOUT_MS, stickToMove, type HeldSeat } from './crewRun';

const joiner = (userId: string) => ({ userId, name: userId, characterId: 'c' });

test('guests take the first free seat, a retry keeps the same seat, and a fifth player is turned away', () => {
  let seats: HeldSeat[] = [];
  for (const id of ['a', 'b', 'c']) {
    const result = seatJoiner(seats, joiner(id), 0);
    assert.notEqual(result, 'full');
    if (result !== 'full') seats = result.seats;
  }
  assert.deepEqual(seats.map((s) => s.id), ['p2', 'p3', 'p4']);
  const retry = seatJoiner(seats, joiner('b'), 5);
  assert.ok(retry !== 'full' && retry.seatId === 'p3' && retry.seats.length === 3);
  assert.equal(seatJoiner(seats, joiner('d'), 0), 'full');
});

test('a seat that leaves is reused by the next player', () => {
  const first = seatJoiner([], joiner('a'), 0);
  const second = first === 'full' ? first : seatJoiner(first.seats, joiner('b'), 0);
  assert.ok(first !== 'full' && second !== 'full');
  if (first === 'full' || second === 'full') return;
  const after = seatLeaves(second.seats, 'p2');
  assert.equal(freeSeatId(after.map((s) => s.id)), 'p2');
});

test('quiet seats drop out and talking keeps a seat alive', () => {
  const seats: HeldSeat[] = [{ id: 'p2', userId: 'a', name: 'a', characterId: 'c', lastHeardAt: 0 }, { id: 'p3', userId: 'b', name: 'b', characterId: 'c', lastHeardAt: 0 }];
  const alive = heardFrom(seats, 'p3', SEAT_TIMEOUT_MS);
  const { seats: kept, dropped } = expireSeats(alive, SEAT_TIMEOUT_MS + 1);
  assert.deepEqual(kept.map((s) => s.id), ['p3']);
  assert.deepEqual(dropped.map((s) => s.id), ['p2']);
});

test('a crew run is offered only for a crewmate who is hosting this crew\'s room', () => {
  const crew: LokCrewState = { crew: { id: 'crew-1', leaderId: 'me', game: 'survivor616' }, members: [member('me'), member('ada'), member('bo')], invites: [] };
  assert.equal(openCrewRun(crew, {}, 'me'), null);
  assert.equal(openCrewRun(crew, { ada: { game: 'survivor616', doing: 'run' } }, 'me'), null);
  assert.equal(openCrewRun(crew, { ada: { game: 'survivor616', doing: 'run', room: 'other' } }, 'me'), null);
  assert.equal(openCrewRun(crew, { me: { game: 'survivor616', doing: 'run', room: 'crew-1' } }, 'me'), null);
  assert.equal(openCrewRun(crew, { bo: { game: 'survivor616', doing: 'run', room: 'crew-1' } }, 'me')?.userId, 'bo');
});

test('run length is capped and the touch stick has a dead zone', () => {
  assert.equal(crewRunLength({ endless: true, durationSec: 0 }), 300);
  assert.equal(crewRunLength({ durationSec: 900 }), 420);
  assert.equal(crewRunLength({ durationSec: 180 }), 180);
  assert.deepEqual(stickToMove(2, 1), { moveX: 0, moveY: 0 });
  const full = stickToMove(200, 0);
  assert.equal(full.moveX, 1);
  assert.ok(Math.abs(stickToMove(27, 0).moveX - 0.5) < 1e-9);
});
