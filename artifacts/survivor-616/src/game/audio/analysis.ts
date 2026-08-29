/**
 * Live tempo and transient analysis for whatever the soundtrack player is
 * playing.
 *
 * The pipeline is the classic one, kept deliberately small so it can run inside
 * the render loop's budget without a worker:
 *
 *   FFT magnitudes -> per-band energy
 *                  -> spectral flux (how much the spectrum just brightened)
 *                  -> adaptive threshold -> onsets
 *                  -> autocorrelation over a flux history -> tempo
 *                  -> a phase-locked loop nudged by onsets -> a stable beat grid
 *
 * The PLL matters more than the tempo estimate. A free-running phase that is
 * gently corrected stays smooth when detection briefly disagrees with the
 * music; snapping straight to every detected onset makes the whole game jitter
 * on a busy hi-hat.
 *
 * Everything is published to `beatBus`, so consumers never touch this module.
 */

import { beatBus, type FrequencyBand } from './beatBus';

/** Upper edge of each band in Hz. Rough, but musically useful. */
const BAND_EDGES: ReadonlyArray<readonly [FrequencyBand, number]> = [
  ['sub', 80],
  ['bass', 250],
  ['lowMid', 800],
  ['mid', 3000],
  ['high', 12_000],
] as const;

/** Flux history resolution. 10ms bins give plenty of tempo resolution. */
const BIN_MS = 10;
/** ~6 seconds of history. Enough for a stable estimate, short enough to adapt. */
const HISTORY_BINS = 600;

const MIN_BPM = 60;
const MAX_BPM = 180;
/** Lag bounds in bins, derived from the tempo range. */
const MIN_LAG = Math.floor((60_000 / MAX_BPM) / BIN_MS);
const MAX_LAG = Math.ceil((60_000 / MIN_BPM) / BIN_MS);

/** Onsets closer together than this are treated as one transient. */
const MIN_ONSET_GAP_MS = 90;
/** How many flux samples the adaptive threshold averages over. */
const THRESHOLD_WINDOW = 43;
/** Threshold = mean + this many standard deviations. */
const THRESHOLD_SIGMA = 1.6;

/** How hard an onset drags the beat phase toward it, per correction. */
const PLL_GAIN = 0.08;
/** Onsets further than this from the grid are ignored as syncopation. */
const PLL_CAPTURE_BEATS = 0.25;

/** Tempo is only re-estimated this often -- autocorrelation is the costly part. */
const TEMPO_INTERVAL_MS = 500;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export interface AnalyserOptions {
  /** Called with the smoothed broadband energy, for the CSS reactive root. */
  onEnergy?: (energy: number) => void;
}

/**
 * Drives analysis of one `AnalyserNode`. Owns a single animation frame loop --
 * the app should never run more than one of these.
 */
export class MusicAnalyser {
  private readonly analyser: AnalyserNode;
  private readonly options: AnalyserOptions;

  /** Explicitly backed by an ArrayBuffer -- `getByteFrequencyData` rejects a
   *  possibly-shared buffer. */
  private readonly magnitudes: Uint8Array<ArrayBuffer>;
  private readonly previousMagnitudes: Float32Array;
  /** Bin index at which each band ends, precomputed from the sample rate. */
  private readonly bandBins: Array<{ band: FrequencyBand; from: number; to: number }> = [];

  private readonly fluxHistory = new Float32Array(HISTORY_BINS);
  private historyWrite = 0;
  private historyFilled = 0;

  private readonly recentFlux: number[] = [];

  private frame: number | null = null;
  private lastTime = 0;
  private binAccumulatorMs = 0;
  private binFluxPeak = 0;
  private lastOnsetAt = 0;
  private lastTempoAt = 0;
  private lastBeatIndex = 0;

  private bpm = 0;
  private confidence = 0;
  private beat = 0;
  private smoothedEnergy = 0;
  private readonly bands: Record<FrequencyBand, number> = {
    sub: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    high: 0,
  };

  constructor(analyser: AnalyserNode, options: AnalyserOptions = {}) {
    this.analyser = analyser;
    this.options = options;
    this.magnitudes = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    this.previousMagnitudes = new Float32Array(analyser.frequencyBinCount);

    const nyquist = analyser.context.sampleRate / 2;
    const binsPerHz = analyser.frequencyBinCount / nyquist;
    let from = 0;
    for (const [band, upperHz] of BAND_EDGES) {
      const to = Math.min(analyser.frequencyBinCount, Math.max(from + 1, Math.round(upperHz * binsPerHz)));
      this.bandBins.push({ band, from, to });
      from = to;
    }
  }

  start(): void {
    if (this.frame !== null || typeof requestAnimationFrame === 'undefined') return;
    this.lastTime = performance.now();
    const loop = (time: number) => {
      this.frame = requestAnimationFrame(loop);
      const dtMs = Math.min(time - this.lastTime, 100);
      this.lastTime = time;
      this.sample(time, dtMs);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.reset();
    this.options.onEnergy?.(0);
    beatBus.release('detected');
  }

  /** Clears tempo state without stopping -- call when the track changes. */
  reset(): void {
    this.fluxHistory.fill(0);
    this.previousMagnitudes.fill(0);
    this.recentFlux.length = 0;
    this.historyWrite = 0;
    this.historyFilled = 0;
    this.binAccumulatorMs = 0;
    this.binFluxPeak = 0;
    this.bpm = 0;
    this.confidence = 0;
    this.beat = 0;
    this.lastBeatIndex = 0;
    this.smoothedEnergy = 0;
    for (const band of Object.keys(this.bands) as FrequencyBand[]) this.bands[band] = 0;
  }

  private sample(time: number, dtMs: number): void {
    this.analyser.getByteFrequencyData(this.magnitudes);

    // --- bands + broadband energy -------------------------------------
    let total = 0;
    for (const { band, from, to } of this.bandBins) {
      let sum = 0;
      for (let i = from; i < to; i += 1) sum += this.magnitudes[i]!;
      const mean = sum / Math.max(1, to - from);
      // Smooth per band; the low bands drive visible motion and must not flicker.
      this.bands[band] = this.bands[band] * 0.7 + clamp01(mean / 180) * 0.3;
      total += sum;
    }
    const broadband = total / Math.max(1, this.magnitudes.length);
    this.smoothedEnergy = this.smoothedEnergy * 0.8 + clamp01(broadband / 150) * 0.2;
    this.options.onEnergy?.(this.smoothedEnergy);

    // --- spectral flux --------------------------------------------------
    let flux = 0;
    for (let i = 0; i < this.magnitudes.length; i += 1) {
      const value = this.magnitudes[i]!;
      const delta = value - this.previousMagnitudes[i]!;
      if (delta > 0) flux += delta;
      this.previousMagnitudes[i] = value;
    }
    flux /= Math.max(1, this.magnitudes.length);

    // --- onset detection against an adaptive threshold ------------------
    this.recentFlux.push(flux);
    if (this.recentFlux.length > THRESHOLD_WINDOW) this.recentFlux.shift();
    let onset = false;
    if (this.recentFlux.length === THRESHOLD_WINDOW) {
      let mean = 0;
      for (const value of this.recentFlux) mean += value;
      mean /= THRESHOLD_WINDOW;
      let variance = 0;
      for (const value of this.recentFlux) variance += (value - mean) ** 2;
      const deviation = Math.sqrt(variance / THRESHOLD_WINDOW);
      if (
        flux > mean + THRESHOLD_SIGMA * deviation &&
        flux > 0.5 &&
        time - this.lastOnsetAt > MIN_ONSET_GAP_MS
      ) {
        onset = true;
        this.lastOnsetAt = time;
      }
    }

    // --- accumulate flux into fixed 10ms bins ---------------------------
    this.binFluxPeak = Math.max(this.binFluxPeak, flux);
    this.binAccumulatorMs += dtMs;
    while (this.binAccumulatorMs >= BIN_MS) {
      this.binAccumulatorMs -= BIN_MS;
      this.fluxHistory[this.historyWrite] = this.binFluxPeak;
      this.historyWrite = (this.historyWrite + 1) % HISTORY_BINS;
      this.historyFilled = Math.min(HISTORY_BINS, this.historyFilled + 1);
      this.binFluxPeak = 0;
    }

    // --- tempo, occasionally --------------------------------------------
    if (time - this.lastTempoAt > TEMPO_INTERVAL_MS && this.historyFilled >= MAX_LAG * 2) {
      this.lastTempoAt = time;
      this.estimateTempo();
    }

    // --- advance the beat phase, nudged by onsets -----------------------
    if (this.bpm > 0) {
      this.beat += (dtMs / 60_000) * this.bpm;
      if (onset) {
        const error = Math.round(this.beat) - this.beat;
        if (Math.abs(error) < PLL_CAPTURE_BEATS) this.beat += error * PLL_GAIN;
      }
    }

    const beat = this.bpm > 0 ? this.beat : 0;
    const phase = beat - Math.floor(beat);
    const beatIndex = Math.floor(beat);
    const downbeat = beatIndex > this.lastBeatIndex && beatIndex % 4 === 0;
    this.lastBeatIndex = beatIndex;

    beatBus.publish(
      {
        bpm: this.bpm,
        confidence: this.confidence,
        beat,
        bar: beat / 4,
        phase,
        beatIndex,
        downbeat,
        energy: this.smoothedEnergy,
        bands: this.bands,
        onset,
      },
      'detected',
    );
  }

  /**
   * Autocorrelate the flux history and pick the strongest periodicity in the
   * musical tempo range. Correlation is normalised by lag so long lags are not
   * penalised for overlapping less.
   */
  private estimateTempo(): void {
    const count = this.historyFilled;
    const at = (index: number): number =>
      this.fluxHistory[(this.historyWrite - count + index + HISTORY_BINS * 2) % HISTORY_BINS]!;

    let mean = 0;
    for (let i = 0; i < count; i += 1) mean += at(i);
    mean /= count;

    let bestLag = 0;
    let bestScore = 0;
    let totalScore = 0;
    let scored = 0;
    const scores = new Map<number, number>();

    for (let lag = MIN_LAG; lag <= MAX_LAG && lag < count; lag += 1) {
      let sum = 0;
      const overlap = count - lag;
      for (let i = 0; i < overlap; i += 1) {
        sum += (at(i) - mean) * (at(i + lag) - mean);
      }
      const score = sum / overlap;
      scores.set(lag, score);
      totalScore += Math.max(0, score);
      scored += 1;
      if (score > bestScore) {
        bestScore = score;
        bestLag = lag;
      }
    }

    if (bestLag === 0 || bestScore <= 0) {
      this.confidence = Math.max(0, this.confidence - 0.2);
      if (this.confidence === 0) this.bpm = 0;
      return;
    }

    // Octave correction: half and double tempo correlate almost as well, so
    // prefer whichever candidate lands nearest a danceable 120bpm.
    let chosenLag = bestLag;
    for (const candidate of [bestLag * 2, Math.round(bestLag / 2)]) {
      if (candidate < MIN_LAG || candidate > MAX_LAG) continue;
      const score = scores.get(candidate);
      if (score === undefined || score < bestScore * 0.8) continue;
      const candidateBpm = 60_000 / (candidate * BIN_MS);
      const chosenBpm = 60_000 / (chosenLag * BIN_MS);
      if (Math.abs(candidateBpm - 120) < Math.abs(chosenBpm - 120)) chosenLag = candidate;
    }

    const nextBpm = 60_000 / (chosenLag * BIN_MS);
    const meanScore = totalScore / Math.max(1, scored);
    // How far the winning peak stands above the average correlation.
    const peakRatio = meanScore > 0 ? bestScore / meanScore : 0;
    this.confidence = clamp01((peakRatio - 1) / 3);

    if (this.bpm === 0) {
      this.bpm = nextBpm;
      return;
    }
    // Ease toward the new estimate unless it is a genuine tempo change, so a
    // single bad window cannot yank the grid.
    const drift = Math.abs(nextBpm - this.bpm) / this.bpm;
    this.bpm = drift > 0.25 ? nextBpm : this.bpm * 0.8 + nextBpm * 0.2;
  }
}
