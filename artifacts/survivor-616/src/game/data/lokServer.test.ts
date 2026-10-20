import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LOKSERVER_TOPICS, LOKSHOP_STOCK, lokServerVoice } from '@/game/data/lokServer';
import { createRng } from '@/game/engine/math';
import { lokServerSay } from '@/game/engine/lokServerSpeak';

const EN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', 'en.json'), 'utf8')) as Record<string, string>;
const BANNED = new RegExp(['sig', 'nal'].join(''), 'i');

describe('LokServer', () => {
  it('has unique topics and stock, each with locale text', () => {
    assert.equal(new Set(LOKSERVER_TOPICS.map((t) => t.id)).size, LOKSERVER_TOPICS.length);
    assert.equal(new Set(LOKSHOP_STOCK.map((i) => i.id)).size, LOKSHOP_STOCK.length);
    for (const topic of LOKSERVER_TOPICS) assert.ok(EN[topic.labelKey], topic.labelKey);
    for (const item of LOKSHOP_STOCK) {
      assert.ok(EN[item.nameKey], item.nameKey);
      assert.ok(EN[item.blurbKey], item.blurbKey);
      assert.ok(item.price > 0);
    }
  });

  it('speaks a non-empty, repeatable, kid-safe line on every topic', () => {
    for (const topic of LOKSERVER_TOPICS) {
      const line = lokServerSay(topic.id, createRng(5));
      assert.ok(line.trim().length > 0, topic.id);
      assert.equal(line, lokServerSay(topic.id, createRng(5)));
      assert.doesNotMatch(line, /[{}<>]/);
      const voice = lokServerVoice(topic.id);
      assert.doesNotMatch([...voice.openers, ...voice.topics, ...voice.closers].join(' '), BANNED);
    }
  });
});
