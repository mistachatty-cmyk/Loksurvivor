/** Original procedural drum palettes and the sample pad playback path. */
import * as Tone from 'tone';

import { getBuffer } from './importer';
import type { StudioDrumKit } from './project';

type PadVoice = {
  trigger: (time: number, velocity: number) => void;
  stop: (time: number) => void;
  dispose: () => void;
};

const LOW_PADS = new Set([0, 5, 6, 14]);
const NOISE_PADS = new Set([1, 2, 3, 4, 8, 12, 13]);

export class DrumRack {
  private readonly voices: PadVoice[];

  constructor(readonly kit: StudioDrumKit, destination: Tone.ToneAudioNode) {
    this.voices = kit.pads.map((pad, index): PadVoice => {
      const output = new Tone.Gain(pad.gain).connect(destination);
      if (pad.sourceId) {
        const buffer = getBuffer(pad.sourceId);
        if (!buffer) return { trigger: () => {}, stop: () => {}, dispose: () => output.dispose() };
        const player = new Tone.Player(buffer).connect(output);
        player.playbackRate = 2 ** (pad.tuneSemitones / 12);
        const start = Math.min(pad.trimStartSeconds, buffer.duration);
        const end = pad.trimEndSeconds > start ? Math.min(pad.trimEndSeconds, buffer.duration) : buffer.duration;
        return {
          trigger: (time, velocity) => {
            output.gain.setValueAtTime(Math.max(0, pad.gain * velocity), time);
            if (end > start) {
              if (player.state === 'started') player.restart(time, start, end - start);
              else player.start(time, start, end - start);
            }
          },
          stop: (time) => { if (player.state === 'started') player.stop(time); },
          dispose: () => { player.dispose(); output.dispose(); },
        };
      }

      const tint = kit.palette === 'rust' ? -5 : kit.palette === 'neon' ? 6 : 0;
      const pitch = 38 + index * 3 + tint + pad.tuneSemitones;
      if (LOW_PADS.has(index)) {
        const voice = new Tone.MembraneSynth({
          pitchDecay: kit.palette === 'rust' ? 0.12 : 0.045,
          octaves: kit.palette === 'neon' ? 5 : 3,
          envelope: { attack: 0.001, decay: index === 14 ? 0.6 : 0.25, sustain: 0, release: 0.05 },
        }).connect(output);
        return {
          trigger: (time, velocity) => voice.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toNote(), '8n', time, velocity),
          stop: () => voice.triggerRelease(),
          dispose: () => { voice.dispose(); output.dispose(); },
        };
      }
      if (NOISE_PADS.has(index)) {
        const voice = new Tone.NoiseSynth({
          noise: { type: kit.palette === 'rust' ? 'brown' : kit.palette === 'neon' ? 'pink' : 'white' },
          envelope: { attack: 0.001, decay: index === 3 || index === 12 || index === 13 ? 0.38 : 0.09, sustain: 0, release: 0.02 },
        }).connect(output);
        return {
          trigger: (time, velocity) => voice.triggerAttackRelease('16n', time, velocity),
          stop: (time) => voice.triggerRelease(time),
          dispose: () => { voice.dispose(); output.dispose(); },
        };
      }
      const voice = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.15, release: 0.02 },
        harmonicity: kit.palette === 'neon' ? 7 : 4,
        modulationIndex: kit.palette === 'rust' ? 18 : 25,
      }).connect(output);
      voice.frequency.value = 180 + index * 24 + tint * 8 + pad.tuneSemitones * 10;
      return {
        trigger: (time, velocity) => voice.triggerAttackRelease('16n', time, velocity),
        stop: (time) => voice.triggerRelease(time),
        dispose: () => { voice.dispose(); output.dispose(); },
      };
    });
  }

  trigger(padIndex: number, time: number, velocity: number): void {
    const pad = this.kit.pads[padIndex];
    if (!pad) return;
    if (pad.chokeGroup > 0) this.kit.pads.forEach((other, index) => {
      if (index !== padIndex && other.chokeGroup === pad.chokeGroup) this.voices[index]?.stop(time);
    });
    this.voices[padIndex]?.trigger(time, velocity);
  }

  stop(time: number): void {
    this.voices.forEach((voice) => voice.stop(time));
  }

  dispose(): void {
    this.voices.forEach((voice) => voice.dispose());
  }
}
