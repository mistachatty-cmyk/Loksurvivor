/**
 * The Jukebox track manifest: how an app describes its songs to the Jukebox.
 *
 * The audio itself (files, unlocks, playback) stays with the app's own player.
 * A manifest entry only adds how a disc looks and, later, where to read more.
 * `validateManifest` returns a list of problems instead of throwing, so an app's
 * test can fail with something readable.
 */

export const DISC_PATTERNS = Object.freeze([
  'sunburst',
  'rings',
  'halftone',
  'horizon',
  'stripes',
  'eclipse',
  'mosaic',
]);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateManifest(tracks) {
  const problems = [];
  if (!Array.isArray(tracks)) return ['manifest is not an array'];
  const seen = new Set();
  tracks.forEach((track, i) => {
    const where = `track ${i}`;
    if (!track || typeof track !== 'object') {
      problems.push(`${where}: not an object`);
      return;
    }
    if (typeof track.id !== 'string' || track.id === '') problems.push(`${where}: missing id`);
    else if (seen.has(track.id)) problems.push(`${where}: duplicate id ${track.id}`);
    else seen.add(track.id);
    if (typeof track.title !== 'string' || track.title.trim() === '') problems.push(`${where}: missing title`);
    if (track.pattern !== undefined && !DISC_PATTERNS.includes(track.pattern)) {
      problems.push(`${where}: unknown pattern ${String(track.pattern)}`);
    }
    if (track.palette !== undefined) {
      const ok = Array.isArray(track.palette) && track.palette.length === 3 && track.palette.every((c) => typeof c === 'string' && HEX.test(c));
      if (!ok) problems.push(`${where}: palette must be three hex colors`);
    }
    if (track.links !== undefined) {
      const ok = Array.isArray(track.links) && track.links.every((l) => l && typeof l.label === 'string' && /^https:\/\//.test(String(l.href)));
      if (!ok) problems.push(`${where}: links need a label and an https href`);
    }
  });
  return problems;
}
