import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font, springConfig } from '../theme';

/**
 * Counts a number up over `durationInFrames`, starting at `delay`.
 * Deliberately the same easing idea as the in-app useCountUp hook so the video
 * and the run summary screen feel like one gesture.
 */
export const CountUp: React.FC<{
  value: number;
  delay?: number;
  durationInFrames?: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}> = ({
  value,
  delay = 0,
  durationInFrames = 40,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame - delay,
    [0, durationInFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Ease-out cubic: fast arrival, slow settle — reads as a tally landing.
  const eased = 1 - Math.pow(1 - progress, 3);
  return <span style={style}>{format(value * eased)}</span>;
};

/** Entrance used for every block in the video. One gesture, reused. */
export const useRise = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: springConfig });
  return {
    opacity: interpolate(s, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(s, [0, 1], [18, 0])}px)`,
  };
};

export const Rise: React.FC<{
  delay?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, style }) => (
  <div style={{ ...useRise(delay), ...style }}>{children}</div>
);

/** Label text. Sentence case, never tracked-out caps. */
export const Label: React.FC<{
  children: React.ReactNode;
  tone?: keyof typeof color;
}> = ({ children, tone = 'muted' }) => (
  <div
    style={{
      fontFamily: font.body,
      fontSize: 26,
      fontWeight: 500,
      color: color[tone],
      letterSpacing: '0.01em',
    }}
  >
    {children}
  </div>
);

/**
 * A hairline that draws itself left-to-right. Used as a structural divider
 * between the identity block and the numbers, nothing else.
 */
export const DrawnRule: React.FC<{ delay?: number; width: number }> = ({
  delay = 0,
  width,
}) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 24], [0, width], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ height: 1, width: w, background: color.line }} />;
};

/** Static film grain — a fixed SVG so it never costs a per-frame redraw. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.045 }) => (
  <svg
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      opacity,
      pointerEvents: 'none',
      mixBlendMode: 'overlay',
    }}
  >
    <filter id="recap-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
    </filter>
    <rect width="100%" height="100%" filter="url(#recap-grain)" />
  </svg>
);
