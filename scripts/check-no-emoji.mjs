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
const files = execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean);
let bad = 0;
for (const f of files) {
  if (SKIP.test(f) || f === 'scripts/check-no-emoji.mjs') continue;
  let text; try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((l, i) => { if (isEmoji(l)) { bad++; console.error(`${f}:${i + 1}: emoji found`); } });
}
if (bad) { console.error(`\n${bad} line(s) contain emoji. Lok standard: no emoji. Use GameIcon or plain text.`); process.exit(1); }
console.log('no-emoji check passed');
