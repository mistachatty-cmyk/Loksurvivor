import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';
import { CountUp, Label, Rise } from '../components/primitives';
import { formatClock } from '../adapter';
import type { RunRecapProps } from '../schema';

/**
 * The one loud moment in the video. Survival time gets the whole upper field
 * and the only large type in the piece; the three supporting numbers sit
 * underneath at a quarter its size. Everything else in the recap stays quiet so
 * this lands.
 */
export const StatSlam: React.FC<{ data: RunRecapProps; width: number }> = ({
  data,
  width,
}) => {
  const frame = useCurrentFrame();
  const { stats, best } = data;

  const beatBest = best !== null && stats.timeSurvivedSeconds > best.timeSurvivedSeconds;
  const heroTone = beatBest ? color.gold : color.accent;

  // A single pulse at the moment the clock finishes counting.
  const landed = interpolate(frame, [58, 66], [1.035, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exit = interpolate(frame, [138, 150], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const supporting: Array<{ label: string; value: number; delay: number }> = [
    { label: 'Kills', value: stats.kills, delay: 62 },
    { label: 'Level', value: stats.level, delay: 70 },
    { label: 'Cred', value: stats.cred, delay: 78 },
  ];

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        padding: width * 0.09,
        opacity: exit,
      }}
    >
      <Rise delay={4}>
        <Label>Survived</Label>
      </Rise>

      <div
        style={{
          fontFamily: font.display,
          fontSize: width * 0.3,
          fontWeight: 700,
          lineHeight: 0.86,
          color: heroTone,
          letterSpacing: '-0.045em',
          fontVariantNumeric: 'tabular-nums',
          transform: `scale(${landed})`,
          transformOrigin: 'left center',
          marginTop: 6,
        }}
      >
        <CountUp
          value={stats.timeSurvivedSeconds}
          delay={10}
          durationInFrames={48}
          format={(n) => formatClock(n)}
        />
      </div>

      {beatBest && best ? (
        <Rise delay={66} style={{ marginTop: 14 }}>
          <div style={{ fontFamily: font.body, fontSize: 30, color: color.gold }}>
            Personal best — past {formatClock(best.timeSurvivedSeconds)}
          </div>
        </Rise>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: width * 0.075,
          marginTop: width * 0.11,
        }}
      >
        {supporting.map((s) => (
          <Rise key={s.label} delay={s.delay}>
            <Label>{s.label}</Label>
            <div
              style={{
                fontFamily: font.display,
                fontSize: width * 0.085,
                fontWeight: 600,
                color: color.text,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 2,
              }}
            >
              <CountUp value={s.value} delay={s.delay + 2} durationInFrames={34} />
            </div>
          </Rise>
        ))}
      </div>

      {typeof stats.damageTaken === 'number' ? (
        <Rise delay={92} style={{ marginTop: width * 0.05 }}>
          <div style={{ fontFamily: font.body, fontSize: 28, color: color.muted }}>
            Damage taken{' '}
            <span style={{ color: color.heat, fontVariantNumeric: 'tabular-nums' }}>
              <CountUp value={stats.damageTaken} delay={94} durationInFrames={28} />
            </span>
          </div>
        </Rise>
      ) : null}
    </AbsoluteFill>
  );
};
