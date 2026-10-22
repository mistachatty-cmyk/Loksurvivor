import { ArrowRight, Home, Map, Search, Settings, ShoppingBag, Users, type LucideIcon } from 'lucide-react';

import { useMeta } from '@/game/state/metaStore';
import { useT, type MessageKey } from '@/lib/i18n';
import { pageScreens } from '@/lib/screenSlide';
import { useSelectedMap } from '@/lib/selectedMap';

export const OPEN_GO_TO_EVENT = 'survivor616:open-go-to';

interface DockItem {
  id: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Screen names that count as "being here" for the highlight. */
  screens: string[];
}

const ITEMS: DockItem[] = [
  { id: 'hub', label: 'goto.hub', icon: Home, screens: pageScreens('hub') },
  { id: 'areas', label: 'goto.areas', icon: Map, screens: pageScreens('areas') },
  { id: 'roster', label: 'goto.roster', icon: Users, screens: pageScreens('roster') },
  { id: 'card-shop', label: 'goto.cardShop', icon: ShoppingBag, screens: pageScreens('card-shop') },
  { id: 'settings', label: 'goto.settings', icon: Settings, screens: pageScreens('settings') },
];

interface Props {
  screenName: string;
  onGo: (id: string) => void;
  /** Launches the selected map, or opens the map list when none is picked. */
  onHeadOut: () => void;
}

/** Always-there navigation for menu screens: bottom bar on phones, a slim rail on larger screens. */
export function MenuDock({ screenName, onGo, onHeadOut }: Props) {
  const t = useT();
  const { unlockedAreas, meta } = useMeta();
  const selectedId = useSelectedMap();
  const selectedName =
    unlockedAreas.find((area) => area.id === selectedId)?.name ??
    meta.customMaps.find((map) => map.id === selectedId)?.name ??
    null;
  const itemClass = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-[color,background-color,transform] duration-[var(--dur-fast)] active:scale-95 sm:min-h-12 sm:w-full sm:flex-none sm:py-2 ${
      active ? 'bg-primary/15 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'
    }`;
  return (
    <nav
      aria-label={t('goto.dockLabel')}
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-col border-t border-white/15 bg-black/90 pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:w-20 sm:justify-center sm:border-r sm:border-t-0 sm:pb-0 sm:pr-0"
      data-testid="menu-dock"
    >
      <button
        type="button"
        onClick={onHeadOut}
        className="relative flex min-h-12 w-full flex-col items-center justify-center bg-primary px-2 text-primary-foreground transition active:scale-[0.99] hover:bg-white sm:min-h-14 sm:px-1"
        data-testid="dock-head-out"
      >
        <span className="max-w-full truncate font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-primary-foreground/45" data-testid="dock-head-out-quick">
          {selectedName ? `${t('dock.quick')} · ${selectedName}` : t('dock.quick')}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-sm font-black uppercase tracking-widest sm:text-[10px] sm:tracking-wider">
          {t('dock.headOut')} <ArrowRight className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden="true" />
        </span>
      </button>
      <div className="flex sm:flex-col">
      {ITEMS.map(({ id, label, icon: Icon, screens }) => {
        const active = screens.includes(screenName);
        return (
          <button key={id} type="button" onClick={() => onGo(id)} aria-current={active ? 'page' : undefined} className={itemClass(active)} data-testid={`dock-${id}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{t(label)}</span>
          </button>
        );
      })}
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_GO_TO_EVENT))} className={itemClass(false)} data-testid="dock-search">
        <Search className="h-5 w-5" aria-hidden="true" />
        <span className="max-w-full truncate">{t('goto.search')}</span>
      </button>
      </div>
    </nav>
  );
}
