import React from 'react';
import { AbsoluteFill, Sequence, Video, interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';
import { Label, Rise } from '../components/primitives';
import { formatClock } from '../adapter';
import type { RunRecapProps } from '../schema';

const KIND_LABEL: Record<string, string> = {
  'level-up': 'Level up',
  'boss-defeated': 'Boss down',
  'close-call': 'Close call',
  ultimate: 'Ultimate',
  'ally-rescued': 'Ally rescued',
  'run-cleared': 'Block cleared',
  'run-ended': 'Final stand',
};

/**
 * The one scene in the piece backed by real footage instead of numbers --
 * cuts through the run's own captured clips (see `game/media/clipRecorder.ts`
 * on the game side), because a "highlight reel" that only shows stats isn't
 * actually one.
 *
 * Falls back to a plain text beat list when the browser couldn't capture any
 * clips (unsupported MediaRecorder/captureStream, storage full, or an older
 * saved recap from before this existed) -- every run still gets a complete
 * recap, per the additive-basement rule in
 * `docs/studio-remotion-architecture.md`.
 */
export const HighlightReel: React.FC<{
  data: RunRecapProps;
  width: number;
  durationInFrames: number;
}> = ({ data, width, durationInFrames }) => {
  const frame = useCurrentFrame();
  const clips = data.highlightClips;

  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (clips.length === 0) {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', padding: width * 0.09, opacity: exit }}>
        <Rise delay={0}>
          <Label>Highlights</Label>
        </Rise>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {data.milestones.slice(0, 5).map((m, i) => (
            <Rise key={`${m.at}-${i}`} delay={6 + i * 4}>
              <div style={{ fontFamily: font.body, fontSize: 30, color: color.text }}>
                {m.label}
                <span style={{ marginLeft: 12, fontFamily: font.mono, fontSize: 22, color: color.muted }}>
                  {formatClock(m.at)}
                </span>
              </div>
            </Rise>
          ))}
        </div>
      </AbsoluteFill>
    );
  }

  const slot = Math.max(1, Math.floor(durationInFrames / clips.length));

  return (
    <AbsoluteFill style={{ background: color.void, opacity: exit }}>
      {clips.map((clip, i) => (
        <Sequence key={`${clip.kind}-${clip.atMs}`} from={i * slot} durationInFrames={slot}>
          <AbsoluteFill>
            <Video src={clip.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <AbsoluteFill
              style={{
                justifyContent: 'flex-end',
                padding: width * 0.07,
                background: 'linear-gradient(to top, rgba(10,11,14,0.75), rgba(10,11,14,0) 45%)',
              }}
            >
              <Rise delay={2}>
                <div
                  style={{
                    fontFamily: font.display,
                    fontSize: width * 0.06,
                    fontWeight: 700,
                    color: color.text,
                  }}
                >
                  {KIND_LABEL[clip.kind] ?? clip.label}
                </div>
                <div style={{ fontFamily: font.mono, fontSize: 22, color: color.muted, marginTop: 4 }}>
                  {formatClock(clip.atMs / 1000)}
                </div>
              </Rise>
            </AbsoluteFill>
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
