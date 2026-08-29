/**
 * The playback graph: the live Tone nodes behind the plain-data project model.
 *
 * `project.ts` describes *what* a song is; this module owns the nodes that make
 * it audible and keeps them reconciled with that description. The split is the
 * point -- the model stays serialisable and testable in node, and every Web
 * Audio object lives here.
 *
 * Routing rule, carried forward from the plugin plan: nothing ever calls
 * `a.connect(b)` between a source and the master directly. Every track owns an
 * ordered `inserts` array and `rewire()` is the only thing that connects
 * anything, so an effect -- or later a WAM plugin exposing a raw `AudioNode` --
 * can be dropped into a slot without touching playback code.
 */

import * as Tone from 'tone';

import { findEffect } from './effects';
import { getBuffer } from './importer';
import { findInstrument, triggerInstrument, type InstrumentDef } from './instruments';
import { secondsPerBeat, trackAudible, type StudioProject, type StudioTrack } from './project';

/** Anything that can sit in an insert slot: a Tone effect or a WAM plugin. */
export type InsertNode = Tone.ToneAudioNode | AudioNode;

/**
 * Effect *records* always build Tone nodes; only plugins are raw. Parameter
 * application is meaningful for the former alone, so it narrows through here
 * rather than assuming the slot's origin.
 */
function isToneNode(node: InsertNode): node is Tone.ToneAudioNode {
  return node instanceof Tone.ToneAudioNode;
}

/** Live nodes for one track. Created on demand, disposed with the graph. */
interface TrackNodes {
  gain: Tone.Gain;
  panner: Tone.Panner;
  /**
   * Ordered effect slots between the players and the fader.
   *
   * Typed to include a raw `AudioNode` because a WAM plugin is one: it is not
   * a Tone node and never will be. `Tone.connect` bridges both directions,
   * which is the entire reason this chain is rebuilt through one function.
   */
  inserts: InsertNode[];
  /** Effect instance ids, parallel to `inserts`. */
  effectIds: string[];
  /** One player per clip, keyed by clip id. */
  players: Map<string, Tone.Player>;
  /** The synth voice, when this is an instrument track. */
  voice: ReturnType<InstrumentDef['create']> | null;
  /** Which instrument `voice` was built from, so a change rebuilds it. */
  voiceId: string | null;
  /** Transport event ids, so a re-schedule can cancel exactly its own events. */
  scheduled: number[];
}

export class TrackGraph {
  private readonly master: Tone.Gain;
  private readonly tracks = new Map<string, TrackNodes>();

  constructor(master: Tone.Gain) {
    this.master = master;
  }

  /**
   * Brings the graph in line with `project`: adds nodes for new tracks and
   * clips, drops the ones that are gone, and applies gain/pan/mute/solo.
   *
   * Called on every project edit. Cheap for the common case (a fader move)
   * because existing nodes are reused rather than rebuilt -- rebuilding would
   * click, and clicking on every slider frame is unusable.
   */
  sync(project: StudioProject): void {
    const seen = new Set<string>();

    for (const track of project.tracks) {
      seen.add(track.id);
      const nodes = this.tracks.get(track.id) ?? this.createTrack(track.id);
      this.syncClips(nodes, track);
      this.syncVoice(nodes, track);
      this.syncEffects(nodes, track);
      this.applyMix(nodes, project, track);
    }

    for (const [id, nodes] of this.tracks) {
      if (!seen.has(id)) {
        this.disposeTrack(nodes);
        this.tracks.delete(id);
      }
    }
  }

  private createTrack(id: string): TrackNodes {
    const gain = new Tone.Gain(0.8);
    const panner = new Tone.Panner(0);
    const nodes: TrackNodes = {
      gain,
      panner,
      inserts: [],
      effectIds: [],
      players: new Map(),
      voice: null,
      voiceId: null,
      scheduled: [],
    };
    this.tracks.set(id, nodes);
    this.rewire(nodes);
    return nodes;
  }

  /**
   * The single place anything is connected. Tears the chain down and rebuilds
   * it as players -> inserts... -> gain -> panner -> master, so insert order is
   * always exactly the `inserts` array.
   */
  private rewire(nodes: TrackNodes): void {
    for (const player of nodes.players.values()) player.disconnect();
    nodes.voice?.disconnect();
    for (const insert of nodes.inserts) insert.disconnect();
    nodes.gain.disconnect();
    nodes.panner.disconnect();

    const chain: InsertNode[] = [...nodes.inserts, nodes.gain, nodes.panner];
    const head = chain[0]!;
    // Tone.connect rather than node.connect: it accepts a Tone node or a raw
    // AudioNode on either end, so a plugin slot needs no special case.
    for (const player of nodes.players.values()) Tone.connect(player, head);
    if (nodes.voice) Tone.connect(nodes.voice, head);
    for (let i = 0; i < chain.length - 1; i += 1) Tone.connect(chain[i]!, chain[i + 1]!);
    nodes.panner.connect(this.master);
  }

  /** Adds an effect or plugin node at the end of the chain. */
  addInsert(trackId: string, node: InsertNode): void {
    const nodes = this.tracks.get(trackId);
    if (!nodes) return;
    nodes.inserts.push(node);
    this.rewire(nodes);
  }

  removeInsert(trackId: string, node: InsertNode): void {
    const nodes = this.tracks.get(trackId);
    if (!nodes) return;
    const index = nodes.inserts.indexOf(node);
    if (index === -1) return;
    nodes.inserts.splice(index, 1);
    node.disconnect();
    this.rewire(nodes);
  }

  private syncClips(nodes: TrackNodes, track: StudioTrack): void {
    const seen = new Set<string>();
    let added = false;

    for (const clip of track.clips) {
      seen.add(clip.id);
      if (nodes.players.has(clip.id)) continue;
      const buffer = getBuffer(clip.bufferId);
      // A project can outlive its audio -- imports are not persisted, so a
      // reloaded song references buffers that are simply gone. Skipping keeps
      // the rest of the arrangement playable.
      if (!buffer) continue;
      const player = new Tone.Player(buffer);
      nodes.players.set(clip.id, player);
      added = true;
    }

    for (const [id, player] of nodes.players) {
      if (seen.has(id)) continue;
      player.dispose();
      nodes.players.delete(id);
    }

    if (added) this.rewire(nodes);
  }

  /**
   * Builds or drops the synth voice for an instrument track.
   *
   * Rebuilt only when the chosen instrument actually changes -- disposing and
   * recreating a PolySynth cuts every note currently sounding.
   */
  private syncVoice(nodes: TrackNodes, track: StudioTrack): void {
    if (nodes.voiceId === (track.instrumentId ?? null)) return;

    nodes.voice?.disconnect();
    nodes.voice?.dispose();
    nodes.voice = null;
    nodes.voiceId = track.instrumentId ?? null;

    if (track.instrumentId) nodes.voice = findInstrument(track.instrumentId).create();
    this.rewire(nodes);
  }

  /**
   * Reconciles the insert chain with the model.
   *
   * Nodes are keyed by the effect *instance* id, so two reverbs on one track
   * stay distinct and reordering does not rebuild either of them. Only a
   * changed set of instances triggers a rewire; a parameter move does not,
   * because re-connecting the graph on every slider frame would click.
   */
  private syncEffects(nodes: TrackNodes, track: StudioTrack): void {
    const desired = track.effects.map((effect) => effect.id);
    const current = [...nodes.effectIds];
    const changed =
      desired.length !== current.length || desired.some((id, index) => id !== current[index]);

    if (changed) {
      for (const node of nodes.inserts) {
        node.disconnect();
        // A raw AudioNode (a plugin) has no dispose; its host owns it.
        if ('dispose' in node) node.dispose();
      }
      nodes.inserts = [];
      nodes.effectIds = [];

      for (const effect of track.effects) {
        const def = findEffect(effect.effectId);
        // An unknown effect id means a project from a newer build; skipping it
        // keeps the rest of the chain working rather than failing the track.
        if (!def) continue;
        nodes.inserts.push(def.create());
        nodes.effectIds.push(effect.id);
      }
      this.rewire(nodes);
    }

    // Parameters are applied every sync, changed chain or not -- this is the
    // path a slider move takes.
    track.effects.forEach((effect) => {
      const index = nodes.effectIds.indexOf(effect.id);
      if (index === -1) return;
      const def = findEffect(effect.effectId);
      const node = nodes.inserts[index];
      if (!def || !node || !isToneNode(node)) return;
      for (const param of def.params) {
        param.set(node, effect.params[param.id] ?? param.defaultValue);
      }
    });
  }

  private applyMix(nodes: TrackNodes, project: StudioProject, track: StudioTrack): void {
    // Solo is a project-wide question, so it cannot be read off the track alone.
    const audible = trackAudible(project, track);
    // Ramp rather than set: an instant gain jump is an audible click.
    nodes.gain.gain.rampTo(audible ? track.gain : 0, 0.02);
    nodes.panner.pan.rampTo(track.pan, 0.02);
  }

  /**
   * Places every clip on the transport at its beat position.
   *
   * Scheduling is separate from `sync()` because it must happen once per
   * playback, not once per edit: re-scheduling while running would stack
   * duplicate starts on top of the ones already queued.
   */
  schedule(project: StudioProject): void {
    this.clearSchedule();
    const beatSeconds = secondsPerBeat(project.bpm);
    const transport = Tone.getTransport();

    for (const track of project.tracks) {
      const nodes = this.tracks.get(track.id);
      if (!nodes) continue;

      // Notes on an instrument track.
      const voice = nodes.voice;
      const instrument = track.instrumentId ? findInstrument(track.instrumentId) : null;
      if (voice && instrument) {
        for (const note of track.notes) {
          const at = note.startBeat * beatSeconds;
          const duration = note.lengthBeats * beatSeconds;
          const id = transport.schedule((time) => {
            triggerInstrument(voice, Tone.Frequency(note.pitch, 'midi').toNote(), duration, time);
          }, at);
          nodes.scheduled.push(id);
        }
      }

      for (const clip of track.clips) {
        const player = nodes.players.get(clip.id);
        if (!player) continue;
        const at = clip.startBeat * beatSeconds;
        const duration = clip.lengthBeats * beatSeconds;
        const id = transport.schedule((time) => {
          // Clamp to the buffer: a clip trimmed longer than its source would
          // otherwise throw rather than simply running out of audio.
          player.start(time, 0, Math.min(duration, player.buffer.duration));
        }, at);
        nodes.scheduled.push(id);
      }
    }
  }

  /** Cancels queued starts and stops anything currently sounding. */
  clearSchedule(): void {
    const transport = Tone.getTransport();
    for (const nodes of this.tracks.values()) {
      for (const id of nodes.scheduled) transport.clear(id);
      nodes.scheduled.length = 0;
      for (const player of nodes.players.values()) {
        if (player.state === 'started') player.stop();
      }
      // Cut anything still ringing, or a held pad sustains past stop.
      if (nodes.voice && 'releaseAll' in nodes.voice) nodes.voice.releaseAll();
    }
  }

  private disposeTrack(nodes: TrackNodes): void {
    const transport = Tone.getTransport();
    for (const id of nodes.scheduled) transport.clear(id);
    for (const player of nodes.players.values()) player.dispose();
    nodes.voice?.dispose();
    for (const insert of nodes.inserts) {
      insert.disconnect();
      if ('dispose' in insert) insert.dispose();
    }
    nodes.gain.dispose();
    nodes.panner.dispose();
  }

  dispose(): void {
    for (const nodes of this.tracks.values()) this.disposeTrack(nodes);
    this.tracks.clear();
  }
}
