import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';
import { DrawnRule, Rise } from '../components/primitives';
import type { RunRecapProps } from '../schema';

/**
 * Opens on the thing most characteristic of a run: the clock starting.
 * Identity first, numbers later — the viewer needs to know whose run this is
 * before any figure means anything.
 */
export const ColdOpen: React.FC<{ data: RunRecapProps; width: number }> = ({
  data,
  width,
}) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [48, 60], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const date = new Date(data.run.endedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        padding: width * 0.09,
        opacity: exit,
      }}
    >
      <Rise delay={0}>
        <div
          style={{
            fontFamily: font.body,
            fontSize: 30,
            color: color.muted,
          }}
        >
          {data.player.name} · {date}
        </div>
      </Rise>

      <Rise delay={6} style={{ marginTop: 18 }}>
        <div
          style={{
            fontFamily: font.display,
            fontSize: width * 0.13,
            fontWeight: 700,
            lineHeight: 0.94,
            color: color.text,
            letterSpacing: '-0.02em',
          }}
        >
          {data.run.character}
        </div>
      </Rise>

      <div style={{ marginTop: 28, marginBottom: 28 }}>
        <DrawnRule delay={14} width={width * 0.82} />
      </div>

      <Rise delay={18}>
        <div
          style={{
            fontFamily: font.body,
            fontSize: 34,
            color: color.text,
          }}
        >
          {data.run.stage}
          {data.run.mode === 'endless' ? (
            <span style={{ color: color.accent }}> · endless</span>
          ) : null}
        </div>
      </Rise>

      {data.run.seed ? (
        <Rise delay={24} style={{ marginTop: 12 }}>
          <div
            style={{ fontFamily: font.mono, fontSize: 24, color: color.muted }}
          >
            seed {data.run.seed}
          </div>
        </Rise>
      ) : null}
    </AbsoluteFill>
  );
};
