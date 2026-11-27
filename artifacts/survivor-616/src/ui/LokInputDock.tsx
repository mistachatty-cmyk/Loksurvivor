import { LokInputPad, type LokInputLabels } from '@/lib/lokInput';
import { useT } from '@/lib/i18n';
import { useMemo } from 'react';

/** Game-side adapter: gives the standalone pad its translated text. Mount once per Lok screen. */
export function LokInputDock({ getAudioContext }: { getAudioContext: () => AudioContext | null }) {
  const t = useT();
  const labels = useMemo<LokInputLabels>(
    () => ({
      pointer: t('lokInput.pointer'),
      keyboard: t('lokInput.keyboard'),
      gamepad: t('lokInput.gamepad'),
      lock: t('lokInput.lock'),
      unlock: t('lokInput.unlock'),
      aria: t('lokInput.aria'),
      legend: { pointer: t('lokInput.legend.pointer'), keyboard: t('lokInput.legend.keyboard'), gamepad: t('lokInput.legend.gamepad') },
    }),
    [t],
  );
  return <LokInputPad labels={labels} getAudioContext={getAudioContext} />;
}
