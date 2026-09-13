import React from 'react';
import { Player } from '@remotion/player';

import { toRecapProps, type GameRunSummaryLike } from './adapter';
import { RunRecap } from './RunRecap';
import { FPS, TOTAL_FRAMES } from './theme';

export interface RunRecapPlayerProps {
  summary: GameRunSummaryLike;
  autoPlay?: boolean;
  className?: string;
}

/** The real Remotion composition mounted inside the game's after-action report. */
export function RunRecapPlayer({ summary, autoPlay = false, className }: RunRecapPlayerProps) {
  const inputProps = React.useMemo(() => toRecapProps(summary), [summary]);
  return (
    <div className={className} data-testid="run-recap-player">
      <Player
        component={RunRecap}
        inputProps={inputProps}
        durationInFrames={TOTAL_FRAMES}
        compositionWidth={1920}
        compositionHeight={1080}
        fps={FPS}
        controls
        autoPlay={autoPlay}
        loop={false}
        style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0A0B0E' }}
      />
    </div>
  );
}

export default RunRecapPlayer;
