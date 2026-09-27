---
name: Highlight clip reel in the after-action report
description: Rolling canvas clip capture backing the recap's new HighlightReel scene, and the deliberately deferred browser-support gap.
---

## What this is

The Remotion after-action report (`@lok/recap`, mounted as `RunRecapPlayer` in
`RunSummary`'s "Live after-action report" section) used to be 100% stats and a
text milestone timeline -- no real footage. `game/media/clipRecorder.ts` now
runs a rolling recorder over the run's own canvas throughout play, in short
back-to-back segments (each `MediaRecorder.start()`/`stop()` cycle is its own
complete, independently playable clip -- deliberately not one continuous
recording sliced after the fact, which would need header/concatenation
tricks). When `runHighlights.ts` detects a moment, the segment covering it
gets saved to the local media store (`localMediaStore.ts`, content-addressed,
`kind: 'video'`) and the highlight is tagged with that asset's id.
`RunSummary` resolves those ids to blob URLs and hands them to `@lok/recap`'s
new `HighlightReel` scene, which cuts through the actual clips instead of
another stat card.

## Deliberately deferred: browser support

`clipRecorder.ts` feature-detects `HTMLCanvasElement.prototype.captureStream`
and `window.MediaRecorder` up front (`isClipCaptureSupported()`) and
degrades to a silent no-op on any browser missing either, or on any
mid-capture error (`onerror`, a failed `start()`, a full IndexedDB quota).
`HighlightReel` falls back to the pre-existing text beat list whenever
`data.highlightClips` is empty, so every run still gets a complete recap.

This is not a bug to close: it's the same "protected baseline, no forced
migration" posture the rest of the additive Studio/Remotion work follows (see
`docs/studio-remotion-architecture.md`'s three-zone model and its "fallback or
graceful failure mode where browser capabilities are missing" graduation
gate). Older/unsupported browsers keep the exact experience they had before
this feature existed. Don't "fix" this by polyfilling capture or forcing a
different recording path on those browsers -- if broader coverage is ever
wanted, it's a deliberate follow-up decision, not a defect in this pass.
