import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';
import { Label, Rise } from '../components/primitives';
import { formatClock } from '../adapter';
import type { Milestone, RunRecapProps } from '../schema';

/**
 * The run as a line, because a run genuinely is a sequence — this is the one
 * place in the piece where ordered structure carries information rather than
 * decorating it. The line sweeps at the same rate the run was played, so gaps
 * between markers read as "nothing happened for a while".
 */
const kindTone = (kind: Milestone['kind']): string => {
  switch (kind) {
    case 'boss':
      return color.gold;
    case 'close-call':
      return color.heat;
    case 'evolve':
      return color.accent;
    default:
      return color.muted;
  }
};

export const RunArc: React.FC<{ data: RunRecapProps; width: number }> = ({
  data,
  width,
}) => {
  const frame = useCurrentFrame();
  const total = Math.max(1, data.stats.timeSurvivedSeconds);
  const track = width * 0.82;

  const sweep = interpolate(frame, [6, 78], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [108, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', padding: width * 0.09, opacity: exit }}
    >
      <Rise delay={0}>
        <Label>How the run went</Label>
      </Rise>

      <div style={{ position: 'relative', height: width * 0.62, marginTop: 40 }}>
        {/* the track */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 2,
            height: '100%',
            background: color.line,
          }}
        />
        {/* the swept portion */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 2,
            height: `${sweep * 100}%`,
            background: color.accent,
          }}
        />

        {data.milestones.map((m, i) => {
          const pos = Math.min(1, m.at / total);
          const revealed = sweep >= pos;
          const local = interpolate(
            frame,
            [6 + pos * 72, 6 + pos * 72 + 10],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          return (
            <div
              key={`${m.at}-${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: `${pos * 100}%`,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                opacity: revealed ? local : 0,
                transform: `translate(${interpolate(local, [0, 1], [-10, 0])}px, -50%)`,
                width: track,
              }}
            >
              <div
                style={{
                  width: m.kind === 'level' ? 10 : 16,
                  height: m.kind === 'level' ? 10 : 16,
                  marginLeft: m.kind === 'level' ? -4 : -7,
                  borderRadius: 999,
                  background: kindTone(m.kind),
                }}
              />
              <div
                style={{
                  fontFamily: font.body,
                  fontSize: 27,
                  color: m.kind === 'level' ? color.muted : color.text,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  fontFamily: font.mono,
                  fontSize: 23,
                  color: color.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatClock(m.at)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
