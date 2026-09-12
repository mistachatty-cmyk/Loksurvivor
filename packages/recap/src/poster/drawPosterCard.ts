import { color, font } from '../theme';
import { formatClock } from '../adapter';
import type { RunRecapProps } from '../schema';

/**
 * The free half of the share strategy: a single frame, drawn in the browser
 * with canvas, no Node and no Chromium. It reproduces the stat-slam moment from
 * the video so a shared image and a shared video read as the same artifact.
 *
 * Deliberately not a screenshot of the DOM — html2canvas-style capture drags in
 * a dependency, breaks on custom fonts, and produces a different composition
 * than the video. Drawing it directly keeps the two in sync by hand, which is
 * cheap because there is exactly one frame to keep in sync.
 */

export interface PosterOptions {
  width?: number;
  height?: number;
  /** Device pixel scale. 2 is enough for every social target. */
  scale?: number;
}

const pickFamily = (stack: string) => stack;

export const drawPosterCard = (
  data: RunRecapProps,
  opts: PosterOptions = {},
): HTMLCanvasElement => {
  const W = opts.width ?? 1080;
  const H = opts.height ?? 1350;
  const scale = opts.scale ?? 2;

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(scale, scale);

  const pad = W * 0.09;
  const beatBest =
    data.best !== null &&
    data.stats.timeSurvivedSeconds > data.best.timeSurvivedSeconds;
  const hero = beatBest ? color.gold : color.accent;

  // Ground
  ctx.fillStyle = color.void;
  ctx.fillRect(0, 0, W, H);

  // Identity
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color.muted;
  ctx.font = `500 30px ${pickFamily(font.body)}`;
  const date = new Date(data.run.endedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  ctx.fillText(`${data.player.name} · ${date}`, pad, pad + 30);

  ctx.fillStyle = color.text;
  ctx.font = `700 64px ${pickFamily(font.display)}`;
  ctx.fillText(data.run.character, pad, pad + 110);

  ctx.fillStyle = color.muted;
  ctx.font = `500 30px ${pickFamily(font.body)}`;
  const modeSuffix = data.run.mode === 'endless' ? ' · endless' : '';
  ctx.fillText(`${data.run.stage}${modeSuffix}`, pad, pad + 158);

  // Rule
  ctx.fillStyle = color.line;
  ctx.fillRect(pad, pad + 200, W - pad * 2, 1);

  // Hero number
  ctx.fillStyle = color.muted;
  ctx.font = `500 30px ${pickFamily(font.body)}`;
  ctx.fillText('Survived', pad, pad + 275);

  ctx.fillStyle = hero;
  ctx.font = `700 ${Math.round(W * 0.26)}px ${pickFamily(font.display)}`;
  ctx.fillText(formatClock(data.stats.timeSurvivedSeconds), pad - 6, pad + 500);

  if (beatBest && data.best) {
    ctx.fillStyle = color.gold;
    ctx.font = `500 30px ${pickFamily(font.body)}`;
    ctx.fillText(
      `Personal best — past ${formatClock(data.best.timeSurvivedSeconds)}`,
      pad,
      pad + 556,
    );
  }

  // Supporting row
  const stats: Array<[string, string]> = [
    ['Kills', data.stats.kills.toLocaleString('en-US')],
    ['Level', String(data.stats.level)],
    ['Cred', data.stats.cred.toLocaleString('en-US')],
  ];
  const colW = (W - pad * 2) / 3;
  stats.forEach(([label, value], i) => {
    const x = pad + colW * i;
    ctx.fillStyle = color.muted;
    ctx.font = `500 28px ${pickFamily(font.body)}`;
    ctx.fillText(label, x, pad + 680);
    ctx.fillStyle = color.text;
    ctx.font = `600 ${Math.round(W * 0.075)}px ${pickFamily(font.display)}`;
    ctx.fillText(value, x, pad + 762);
  });

  // Ending
  const endingLine =
    data.run.outcome === 'cleared'
      ? 'Stage cleared'
      : data.run.outcome === 'quit'
        ? 'Walked away'
        : data.run.endedBy
          ? `Taken out by ${data.run.endedBy}`
          : 'Taken out';
  ctx.fillStyle = data.run.outcome === 'cleared' ? color.accent : color.heat;
  ctx.font = `700 44px ${pickFamily(font.display)}`;
  ctx.fillText(endingLine, pad, H - pad - 96);

  ctx.fillStyle = color.muted;
  ctx.font = `500 28px ${pickFamily(font.body)}`;
  ctx.fillText(
    data.player.signedIn
      ? 'LokSurvivor'
      : 'LokSurvivor — sign in to keep runs like this',
    pad,
    H - pad - 40,
  );

  return canvas;
};

export const posterToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Could not encode the card')),
      'image/png',
    );
  });

/**
 * Share sheet where it exists, download everywhere else. Returns what actually
 * happened so the caller can word its confirmation honestly — "Shared" and
 * "Saved" are different events and the UI should not claim one for the other.
 */
export const shareRecapCard = async (
  data: RunRecapProps,
): Promise<'shared' | 'downloaded'> => {
  const blob = await posterToBlob(drawPosterCard(data));
  const file = new File([blob], 'loksurvivor-run.png', { type: 'image/png' });

  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        text: `Survived ${formatClock(data.stats.timeSurvivedSeconds)} in LokSurvivor.`,
      });
      return 'shared';
    } catch (err) {
      // User dismissing the sheet is not a failure — fall through to download
      // only if the sheet itself errored.
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'loksurvivor-run.png';
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
};
