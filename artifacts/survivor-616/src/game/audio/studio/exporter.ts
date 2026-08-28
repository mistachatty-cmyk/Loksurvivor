/**
 * Getting a song back out of the studio: as audio, or as a project file.
 *
 * Audio export renders offline rather than recording the live output. An
 * offline render is deterministic, finishes faster than the song is long, and
 * cannot pick up a glitch from the machine being busy -- `MediaRecorder` fails
 * all three, and additionally re-encodes through whichever codec the browser
 * happens to prefer.
 *
 * The WAV writer is hand-rolled because RIFF is about forty lines of header and
 * a dependency would be larger than the code it replaced.
 */

import * as Tone from 'tone';

import { findEffect } from './effects';
import { getBuffer } from './importer';
import {
  projectLengthBeats,
  secondsPerBeat,
  serializeProject,
  trackAudible,
  type StudioProject,
} from './project';

/** Tail so a reverb or a clip's final transient is not clipped off the end. */
const RENDER_TAIL_SECONDS = 2;
const EXPORT_SAMPLE_RATE = 44_100;
const EXPORT_CHANNELS = 2;

/** How long the rendered file will be, including the tail. */
export function projectDurationSeconds(project: StudioProject): number {
  return projectLengthBeats(project) * secondsPerBeat(project.bpm) + RENDER_TAIL_SECONDS;
}

/**
 * Renders the arrangement to audio.
 *
 * The graph is rebuilt inside the offline callback rather than reusing the live
 * `TrackGraph`: nodes belong to the context they were created in, so the live
 * ones cannot render here, and rebuilding also means an export is unaffected by
 * whatever is currently soloed, playing, or half-scheduled.
 */
export async function renderProjectToWav(project: StudioProject): Promise<Blob> {
  const beatSeconds = secondsPerBeat(project.bpm);
  const duration = projectDurationSeconds(project);

  const rendered = await Tone.Offline(
    ({ transport }) => {
      for (const track of project.tracks) {
        if (!trackAudible(project, track)) continue;

        const gain = new Tone.Gain(track.gain).toDestination();
        const panner = new Tone.Panner(track.pan).connect(gain);

        // Rebuild the insert chain in the same order the live graph uses, or
        // the export would not be the mix the player just heard.
        let head: Tone.ToneAudioNode = panner;
        for (const effect of [...track.effects].reverse()) {
          const def = findEffect(effect.effectId);
          if (!def) continue;
          const node = def.create();
          for (const param of def.params) {
            param.set(node, effect.params[param.id] ?? param.defaultValue);
          }
          node.connect(head);
          head = node;
        }

        for (const clip of track.clips) {
          const buffer = getBuffer(clip.bufferId);
          if (!buffer) continue;
          const player = new Tone.Player(buffer).connect(head);
          const at = clip.startBeat * beatSeconds;
          const length = Math.min(clip.lengthBeats * beatSeconds, buffer.duration);
          transport.schedule((time) => player.start(time, 0, length), at);
        }
      }
      transport.start(0);
    },
    duration,
    EXPORT_CHANNELS,
    EXPORT_SAMPLE_RATE,
  );

  return new Blob([encodeWav(rendered.get() as AudioBuffer)], { type: 'audio/wav' });
}

/**
 * Encodes an `AudioBuffer` as 16-bit PCM RIFF/WAVE.
 *
 * Exported at 16-bit because that is what every DAW, phone and browser reads
 * without negotiation; the studio's own float precision is not worth an export
 * some tools refuse to open.
 */
export function encodeWav(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');

  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // format: uncompressed PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);

  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave. Reading each channel once and striding the writes is markedly
  // faster than calling getChannelData per frame.
  let offset = 44;
  const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, data[channel]![frame] ?? 0));
      // Asymmetric on purpose: -1 and +1 map to the true endpoints of the
      // signed range, so a full-scale signal does not wrap.
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return out;
}

/* --- project files --------------------------------------------------- */

/** A project as a `.616song` file: the arrangement, not the audio. */
export function exportProjectFile(project: StudioProject): Blob {
  return new Blob([serializeProject(project)], { type: 'application/json' });
}

export async function readProjectFile(file: File): Promise<StudioProject> {
  const { parseProject } = await import('./project');
  try {
    return parseProject(JSON.parse(await file.text()) as unknown);
  } catch {
    // `parseProject` repairs a readable-but-wrong project; this is the case
    // where the text was not JSON at all.
    throw new Error(`${file.name} is not a readable .616song file.`);
  }
}

/** Filename-safe version of a project name, for downloads. */
export function exportFilename(project: StudioProject, extension: string): string {
  const base = project.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'untitled';
  return `${base.toLowerCase()}.${extension}`;
}

/**
 * Hands a rendered file to the browser's download flow.
 *
 * The object URL is revoked on a timeout rather than immediately: Safari reads
 * the blob asynchronously after the click and revoking in the same tick gives
 * it an empty file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
