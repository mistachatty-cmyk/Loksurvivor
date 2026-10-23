/**
 * One-way hash for typed phrases, so a secret phrase never has to sit in the shipped bundle as
 * readable text. It is a 53-bit string hash with a salt: not cryptography (a browser game has no
 * place to keep a real secret), but it keeps phrases out of a plain text search of the build.
 * New phrases are hashed with `pnpm exec tsx scripts/hash-phrase.ts <phrase>`.
 */
const SALT = 'lok616.phrase.v1:';

export function hashPhrase(normalized: string): string {
  const input = SALT + normalized;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
