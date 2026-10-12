import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } from 'mediabunny';
import { renderStudioPixels, studioFrameAt, type ClipName, type StudioProject } from './v3Project';

interface Job { project: StudioProject; creator: string; link: string; parentCreator?: string }
self.onmessage = async (event: MessageEvent<Job>) => {
  const { project, creator, link, parentCreator } = event.data;
  try {
    const canvas = new OffscreenCanvas(720, 1280);
    const ctx = canvas.getContext('2d');
    const art = new OffscreenCanvas(48, 48);
    const artCtx = art.getContext('2d');
    if (!ctx || !artCtx) throw new Error('Canvas export is unavailable');
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const source = new CanvasSource(canvas, { codec: 'avc', quality: new Quality({ bitrate: 2_000_000 }) });
    output.addVideoTrack(source, { frameRate: 24 });
    output.setMetadataTags({ title: project.name, artist: creator });
    await output.start();
    const frameCount = 144;
    for (let index = 0; index < frameCount; index++) {
      const seconds = index / 24;
      const clip: ClipName = seconds < 2 ? 'idle' : seconds < 4 ? 'walk' : 'attack';
      const elapsed = (seconds % 2) * 1000;
      renderStudioPixels(artCtx, project, project.views.S[clip][studioFrameAt(project, 'S', clip, elapsed)]!);
      ctx.fillStyle = '#111525'; ctx.fillRect(0, 0, 720, 1280);
      ctx.fillStyle = '#233b49'; ctx.fillRect(28, 115, 664, 820);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 120, 290, 480, 480);
      ctx.fillStyle = '#e5faff'; ctx.font = 'bold 46px sans-serif'; ctx.fillText(project.name.slice(0, 24), 48, 1050);
      ctx.font = '28px sans-serif'; ctx.fillText(`By @${creator.slice(0, 30)}`, 48, 1100);
      if (parentCreator) { ctx.font = '22px sans-serif'; ctx.fillText(`Remix of @${parentCreator.slice(0, 30)}`, 48, 1140); }
      ctx.font = '22px sans-serif'; ctx.fillText(link.slice(0, 52), 48, 1190);
      await source.add(seconds, 1 / 24);
      if (index % 12 === 0) self.postMessage({ kind: 'progress', progress: Math.round(index / frameCount * 100) });
    }
    source.close();
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error('No MP4 data was produced');
    self.postMessage({ kind: 'done', buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ kind: 'error', message: error instanceof Error ? error.message : 'Video export failed' });
  }
};
