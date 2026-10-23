/** Prints the hash to paste into a cheat code's `hashes` list: pnpm exec tsx scripts/hash-phrase.ts "my phrase" */
import { normalizeCheatInput } from '../src/game/data/cheatCodes';
import { hashPhrase } from '../src/lib/phraseHash';

for (const raw of process.argv.slice(2)) console.log(`${hashPhrase(normalizeCheatInput(raw))}  <- ${normalizeCheatInput(raw)}`);
