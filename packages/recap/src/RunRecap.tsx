import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { color, scene } from './theme';
import { Grain } from './components/primitives';
import { ColdOpen } from './scenes/ColdOpen';
import { StatSlam } from './scenes/StatSlam';
import { RunArc } from './scenes/RunArc';
import { Sendoff } from './scenes/Sendoff';
import type { RunRecapProps } from './schema';

/**
 * Scenes cross-cut rather than cross-fade: each one fades itself out in its own
 * last twelve frames, so the cuts are timed inside the scenes and this file
 * stays a pure assembly.
 *
 * All sizing is derived from composition width, which is why the same tree
 * renders correctly at 1080x1920 and 1920x1080 without a second layout.
 */
export const RunRecap: React.FC<RunRecapProps> = (data) => {
  const { width } = useVideoConfig();
  const unit = Math.min(width, 1080);

  return (
    <AbsoluteFill style={{ background: color.void, color: color.text }}>
      <Sequence {...scene.coldOpen}>
        <ColdOpen data={data} width={unit} />
      </Sequence>
      <Sequence {...scene.statSlam}>
        <StatSlam data={data} width={unit} />
      </Sequence>
      <Sequence {...scene.arc}>
        <RunArc data={data} width={unit} />
      </Sequence>
      <Sequence {...scene.sendoff}>
        <Sendoff data={data} width={unit} />
      </Sequence>
      <Grain />
    </AbsoluteFill>
  );
};
