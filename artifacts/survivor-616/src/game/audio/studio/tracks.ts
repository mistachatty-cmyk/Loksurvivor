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

import { getBuffer } from './importer';
import { secondsPerBeat, trackAudible, type StudioProject, type StudioTrack } from './project';

/** Live nodes for one track. Created on demand, disposed with the graph. */
interface TrackNodes {
  gain: Tone.Gain;
  panner: Tone.Panner;
  /** Ordered effect slots between the players and the fader. */
  inserts: Tone.ToneAudioNode[];
  /** One player per clip, keyed by clip id. */
  players: Map<string, Tone.Player>;
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
    const nodes: TrackNodes = { gain, panner, inserts: [], players: new Map(), scheduled: [] };
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
    for (const insert of nodes.inserts) insert.disconnect();
    nodes.gain.disconnect();
    nodes.panner.disconnect();

    const chain: Tone.ToneAudioNode[] = [...nodes.inserts, nodes.gain, nodes.panner];
    const head = chain[0]!;
    for (const player of nodes.players.values()) player.connect(head);
    for (let i = 0; i < chain.length - 1; i += 1) chain[i]!.connect(chain[i + 1]!);
    nodes.panner.connect(this.master);
  }

  /** Adds an effect (or any raw node Tone can wrap) at the end of the chain. */
  addInsert(trackId: string, node: Tone.ToneAudioNode): void {
    const nodes = this.tracks.get(trackId);
    if (!nodes) return;
    nodes.inserts.push(node);
    this.rewire(nodes);
  }

  removeInsert(trackId: string, node: Tone.ToneAudioNode): void {
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
    }
  }

  private disposeTrack(nodes: TrackNodes): void {
    const transport = Tone.getTransport();
    for (const id of nodes.scheduled) transport.clear(id);
    for (const player of nodes.players.values()) player.dispose();
    for (const insert of nodes.inserts) insert.dispose();
    nodes.gain.dispose();
    nodes.panner.dispose();
  }

  dispose(): void {
    for (const nodes of this.tracks.values()) this.disposeTrack(nodes);
    this.tracks.clear();
  }
}
