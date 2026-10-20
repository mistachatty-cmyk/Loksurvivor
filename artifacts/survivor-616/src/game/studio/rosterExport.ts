import type { StudioProject } from './v3Project';

export function exportStudioMp4(project: StudioProject, creator: string, link: string, onProgress: (percent: number) => void, parentCreator?: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') { reject(new Error('Background video export is unavailable on this device')); return; }
    const worker = new Worker(new URL('./rosterExport.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ kind: 'progress' | 'done' | 'error'; progress?: number; buffer?: ArrayBuffer; message?: string }>) => {
      if (event.data.kind === 'progress') onProgress(event.data.progress ?? 0);
      else if (event.data.kind === 'done' && event.data.buffer) { worker.terminate(); resolve(new Blob([event.data.buffer], { type: 'video/mp4' })); }
      else if (event.data.kind === 'error') { worker.terminate(); reject(new Error(event.data.message ?? 'Video export failed')); }
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message || 'Video export failed')); };
    worker.postMessage({ project, creator, link, parentCreator });
  });
}

export async function shareOrDownload(blob: Blob, filename: string, preferShare = false): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Survivor616 creation' }); return; }
    catch (error) { if ((error as DOMException).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
