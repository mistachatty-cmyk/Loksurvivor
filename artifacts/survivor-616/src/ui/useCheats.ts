import { useCallback } from 'react';

import { CHEAT_RESOURCES, resolveCheat, type CheatCodeDef, type CheatResource } from '@/game/data/cheatCodes';
import { useMeta } from '@/game/state/metaStore';
import { fireCheatFx } from '@/lib/cheatFx';
import { useT } from '@/lib/i18n';

export interface CheatOutcome {
  /** True when the text was a cheat that ran. False means it is ordinary chat. */
  handled: boolean;
  message: string;
}

const RESOURCE_KEY = {
  cred: 'cheat.res.cred',
  lootTokens: 'cheat.res.lootTokens',
  cardCredits: 'cheat.res.cardCredits',
  skeletonKeys: 'cheat.res.skeletonKeys',
  lokPetTreats: 'cheat.res.lokPetTreats',
  petElixirs: 'cheat.res.petElixirs',
} as const satisfies Record<CheatResource, string>;

/**
 * Runs typed cheat phrases against the meta store. A resource or unlock cheat typed before the
 * master phrase is just chat (handled: false), so nothing hints that Dev Mode exists.
 */
export function useCheats() {
  const t = useT();
  const { meta, unlockDevModeAccess, cheatGrant, setDevModeAllUnlocks } = useMeta();
  const devAccess = meta.devModeAccessUnlocked;

  const execute = useCallback((code: CheatCodeDef): CheatOutcome => {
    const { effect } = code;
    switch (effect.kind) {
      case 'devAccess':
        unlockDevModeAccess();
        return { handled: true, message: devAccess ? t('cheat.master.again') : t('cheat.master.first') };
      case 'grant': {
        cheatGrant(effect.amounts);
        const parts = CHEAT_RESOURCES.filter((key) => effect.amounts[key]).map((key) => `+${(effect.amounts[key] ?? 0).toLocaleString()} ${t(RESOURCE_KEY[key])}`);
        return { handled: true, message: t('cheat.granted', { list: parts.join(', ') }) };
      }
      case 'allUnlocks':
        setDevModeAllUnlocks(effect.enabled);
        return { handled: true, message: t(effect.enabled ? 'cheat.unlocks.on' : 'cheat.unlocks.off') };
      case 'fx':
        fireCheatFx(effect.fx);
        return { handled: true, message: t(`cheat.fx.${effect.fx}` as 'cheat.fx.confetti') };
    }
  }, [devAccess, unlockDevModeAccess, cheatGrant, setDevModeAllUnlocks, t]);

  const run = useCallback((text: string): CheatOutcome => {
    const resolved = resolveCheat(text, devAccess);
    return resolved.status === 'ready' ? execute(resolved.code) : { handled: false, message: '' };
  }, [devAccess, execute]);

  /** Runs a code straight from its Cheat bar chip (the phrase itself is not stored in the build). */
  const runCode = useCallback((code: CheatCodeDef): CheatOutcome => (
    code.requiresDevAccess && !devAccess ? { handled: false, message: '' } : execute(code)
  ), [devAccess, execute]);

  return { run, runCode, devAccess };
}

export type { CheatCodeDef };
