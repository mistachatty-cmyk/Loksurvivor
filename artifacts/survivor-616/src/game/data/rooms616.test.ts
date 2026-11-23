import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unreachableAnchors, validateLayout } from '../../../../../lib/lok-universe/src/rooms';
import { BEDROOM_616, BEDROOM_PANELS, UNIVERSAL_HALL } from './rooms616';
import type { HubPanel } from '../types';
import en from '../../locales/en.json';

const HUB_PANELS: HubPanel[] = ['runs', 'roster', 'bestiary', 'music', 'studio', 'locker', 'unlocks', 'recovery', 'vendor', 'kennel', 'workshop', 'card-shop', 'weapon-bans', 'grpd-armory', 'settings', 'palette-store', 'sound-booth', 'account', 'feedback', 'threat-matrix'];

test('the 616 bedroom and the universal hall are valid and every object can be reached', () => {
  for (const layout of [BEDROOM_616, UNIVERSAL_HALL]) {
    assert.deepEqual(validateLayout(layout), [], layout.id);
    assert.deepEqual(unreachableAnchors(layout), [], layout.id);
  }
});

test('every bedroom object opens a real hideout panel that has a label, and the main menu items are all there', () => {
  const labels = en as Record<string, string>;
  for (const p of BEDROOM_PANELS) assert.ok(labels[`hub.room.${p}.label`], `missing label for ${p}`);
  for (const p of HUB_PANELS) assert.ok(BEDROOM_PANELS.includes(p), `bedroom is missing ${p}`);
});

test('the bedroom has one door and one lever, and the hall can always walk you home', () => {
  assert.equal(BEDROOM_616.anchors.filter((a) => a.action.type === 'door').length, 1);
  assert.equal(BEDROOM_616.anchors.filter((a) => a.action.type === 'lever').length, 1);
  assert.ok(UNIVERSAL_HALL.anchors.some((a) => a.action.type === 'door' && a.action.to === 'room.616' && a.enabled !== false));
});
