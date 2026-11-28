import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LIGHTHOUSE_CAST, LIGHTHOUSE_PEOPLE } from '../../examples/minimal-cast/cast';
import { createChatActions } from '../actions';
import { createChatEngine } from '../engine';
import { createChatStore } from '../store';
import { LokChatLauncher, LokChatWindow, defaultChatStrings, type LokChatFeatureSource, type LokChatPerson } from './index';

const memory: Record<string, string> = {};
const storage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = v; } } as unknown as Storage;
const engine = createChatEngine(LIGHTHOUSE_CAST);
const store = createChatStore({ key: 'window.test', storage: () => storage });
const runtime = { store, actions: createChatActions({ engine, store }) };
const people: LokChatPerson[] = LIGHTHOUSE_PEOPLE.map((p, i) => ({ ...p, accent: ['#22d3ee', '#e879f9', '#fde047'][i]! }));
const buildContext = (id: string, affinity: number) => ({
  self: LIGHTHOUSE_PEOPLE.find((p) => p.id === id)!, others: LIGHTHOUSE_PEOPLE.filter((p) => p.id !== id), roomName: 'the lamp room', crewHere: [], weather: 'calm', hour: 9, tone: 'family' as const, affinity,
});
const off = (...flags: string[]): LokChatFeatureSource => ({ isOn: (f) => !flags.includes(f), subscribe: () => () => undefined });

describe('LOK Chat window, outside 616 Survivor', () => {
  it('renders the conversation list with initials avatars and the default words', () => {
    const html = renderToStaticMarkup(<LokChatWindow people={people} runtime={runtime} buildContext={buildContext} roomNameOf={() => 'the lamp room'} onClose={() => undefined} />);
    assert.match(html, /data-testid="lok-chat"/);
    assert.match(html, new RegExp(defaultChatStrings.title));
    for (const person of people) assert.ok(html.includes(person.name), person.name);
    assert.match(html, /data-testid="lok-chat-row-mara"/);
    assert.match(html, />M</, 'an initials avatar for Mara');
    assert.match(html, /data-testid="lok-chat-input"/);
  });

  it('shows the group input in the channel only when the group switch is on', () => {
    const channel = (features: LokChatFeatureSource) => renderToStaticMarkup(<LokChatWindow people={people} runtime={runtime} buildContext={buildContext} roomNameOf={() => 'x'} features={features} initialId="channel" onClose={() => undefined} />);
    assert.match(channel(off()), /data-testid="lok-chat-channel-input"/);
    assert.doesNotMatch(channel(off('group')), /data-testid="lok-chat-channel-input"/);
  });

  it('takes an app\'s own avatar and words', () => {
    const html = renderToStaticMarkup(
      <LokChatWindow people={people} runtime={runtime} buildContext={buildContext} roomNameOf={() => 'x'} renderAvatar={(p) => <b data-avatar={p.id}>art</b>} strings={{ ...defaultChatStrings, title: 'Harbor Chat' }} onClose={() => undefined} />,
    );
    assert.match(html, /Harbor Chat/);
    assert.match(html, /data-avatar="wren"/);
  });

  it('the launcher disappears when the messenger is switched off, and labels itself otherwise', () => {
    const on = renderToStaticMarkup(<LokChatLauncher runtime={runtime} onOpen={() => undefined} />);
    assert.match(on, /Open LOK Chat/);
    assert.equal(renderToStaticMarkup(<LokChatLauncher runtime={runtime} features={off('chat')} onOpen={() => undefined} />), '');
  });

  it('quick replies read naturally from the default strings', () => {
    assert.equal(defaultChatStrings.quickLabel('lokChat.quick.pet', { pet: 'Biscuit' }), "How's Biscuit?");
    assert.equal(defaultChatStrings.quickLabel('lokChat.quick.more'), 'Tell me more');
  });
});
