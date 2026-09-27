import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';
import { Rise } from '../components/primitives';
import type { RunRecapProps } from '../schema';

/**
 * Closes on the ending, then one line of direction.
 *
 * The signed-out variant carries the same save-progress ask as the in-app nudge
 * (patch 0003) — the recap is the single most likely thing a player shares, so
 * it is the highest-leverage place that ask can live. Signed-in players get no
 * ask at all; they just get the send-off.
 */
export const Sendoff: React.FC<{ data: RunRecapProps; width: number }> = ({
  data,
  width,
}) => {
  const frame = useCurrentFrame();
  const { run, player } = data;

  const endingLine =
    run.outcome === 'cleared'
      ? 'Stage cleared'
      : run.outcome === 'quit'
        ? 'Walked away'
        : run.endedBy
          ? `Taken out by ${run.endedBy}`
          : 'Taken out';

  const tone = run.outcome === 'cleared' ? color.accent : color.heat;

  const fadeOut = interpolate(frame, [78, 90], [1, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', padding: width * 0.09, opacity: fadeOut }}
    >
      <Rise delay={2}>
        <div
          style={{
            fontFamily: font.display,
            fontSize: width * 0.095,
            fontWeight: 700,
            lineHeight: 1.02,
            color: tone,
            letterSpacing: '-0.02em',
          }}
        >
          {endingLine}
        </div>
      </Rise>

      <Rise delay={16} style={{ marginTop: 26 }}>
        <div style={{ fontFamily: font.body, fontSize: 32, color: color.text }}>
          {player.signedIn
            ? 'Saved to your profile.'
            : 'Sign in to keep runs like this one.'}
        </div>
      </Rise>

      <Rise delay={30} style={{ marginTop: width * 0.12 }}>
        <div
          style={{
            fontFamily: font.display,
            fontSize: 34,
            fontWeight: 600,
            color: color.text,
            letterSpacing: '0.02em',
          }}
        >
          LokSurvivor
        </div>
      </Rise>
    </AbsoluteFill>
  );
};
