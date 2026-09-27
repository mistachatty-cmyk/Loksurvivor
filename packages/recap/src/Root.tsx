import React from 'react';
import { Composition } from 'remotion';
import { RunRecap } from './RunRecap';
import { runRecapSchema, sampleRecap } from './schema';
import { FPS, TOTAL_FRAMES } from './theme';

export const RemotionRoot: React.FC = () => (
  <>
    {/* Primary: what gets shared. */}
    <Composition
      id="RunRecapVertical"
      component={RunRecap}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1080}
      height={1920}
      schema={runRecapSchema}
      defaultProps={sampleRecap}
    />
    {/* Secondary: embeds, store pages, anything horizontal. */}
    <Composition
      id="RunRecapWide"
      component={RunRecap}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      schema={runRecapSchema}
      defaultProps={sampleRecap}
    />
  </>
);
