import { Palette } from 'lucide-react';

import { effectiveCatalogIds } from '@/game/data/devUnlockRegistry';
import { UI_THEMES } from '@/game/data/uiThemes';
import { useMeta } from '@/game/state/metaStore';

/** One tap swaps to the next UI theme you own. The full theme and colour pickers stay in Looks & LokPets. */
export function ThemeCycleButton() {
  const { meta, equipUiTheme } = useMeta();
  const owned = UI_THEMES.filter((theme) => effectiveCatalogIds(meta, 'uiThemes', meta.ownedUiThemeIds).includes(theme.id));
  if (owned.length < 2) return null;
  const index = Math.max(0, owned.findIndex((theme) => theme.id === meta.uiTheme));
  const next = owned[(index + 1) % owned.length]!;
  return (
    <button
      type="button"
      onClick={() => equipUiTheme(next.id)}
      aria-label={`Switch theme (next: ${next.name})`}
      title={`Switch theme: ${next.name}`}
      className="inline-flex min-h-11 min-w-11 items-center justify-center border border-white/25 bg-slate-950/85 text-white/80 shadow-xl backdrop-blur transition hover:border-white/60 hover:text-white active:scale-95"
      data-testid="button-global-switch-theme"
    >
      <Palette className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
