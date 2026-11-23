#!/usr/bin/env node
// Lok design standard: NO EMOJI in any product, doc or generated file. Fails CI if one is found.
// Use line icons (GameIcon / lucide-react), canvas paths, or plain text instead.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BMP = new Set([...'⌚⌛⏩⏪⏫⏬⏰⏳◽◾☔☕♈♉♊♋♌♍♎♏♐♑♒♓♿⚓⚡⚪⚫⚽⚾⛄⛅⛎⛔⛪⛲⛳⛵⛺⛽✅✊✋✨❌❎❓❔❕❗➕➖➗➰➿⬛⬜⭐⭕']);
const SKIP = /\.(png|jpe?g|gif|webp|mp3|m4a|wav|ogg|mp4|woff2?|ttf|ico|glb|zip|pdf|lock|yaml|yml)$/i;
const isEmoji = (line) => {
  for (let i = 0; i < line.length; i++) {
    const cp = line.codePointAt(i);
    if (cp >= 0x1f000 && cp <= 0x1faff) return true;
    if (BMP.has(line[i]) || line[i + 1] === '️') return true;
  }
  return false;
};
// Stock symbol glyphs (arrows, geometric shapes, dingbats, misc symbols) are banned in shipped code too:
// they render as system glyphs and can turn into emoji on phones. Use Lok Facet glyphs (GameIcon / drawGlyph).
const SYMBOL = /[\u2190-\u21FF\u2300-\u23FF\u2500-\u25FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF]/;
const SYMBOL_SCOPE = /^artifacts\/[^/]+\/(src|public)\//;
const files = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
let bad = 0;
for (const f of files) {
  if (SKIP.test(f) || f === 'scripts/check-no-emoji.mjs') continue;
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((l, i) => { const code = l.trim(); const isComment = /^(\/\/|\*|\/\*)/.test(code); if (isEmoji(l) || (SYMBOL_SCOPE.test(f) && !isComment && SYMBOL.test(l))) { bad++; console.error(`${f}:${i + 1}: emoji or stock symbol glyph found`); } });
}
if (bad) { console.error(`\n${bad} line(s) contain emoji or stock symbols. Lok standard: no emoji, no system glyphs. Use GameIcon / drawGlyph or plain text.`); process.exit(1); }
console.log('no-emoji check passed');
