import { Home, Map, Search, Settings, ShoppingBag, Users, type LucideIcon } from 'lucide-react';

import { useT, type MessageKey } from '@/lib/i18n';

export const OPEN_GO_TO_EVENT = 'survivor616:open-go-to';

interface DockItem {
  id: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Screen names that count as "being here" for the highlight. */
  screens: string[];
}

const ITEMS: DockItem[] = [
  { id: 'hub', label: 'goto.hub', icon: Home, screens: ['hub'] },
  { id: 'areas', label: 'goto.areas', icon: Map, screens: ['areas'] },
  { id: 'roster', label: 'goto.roster', icon: Users, screens: ['roster'] },
  { id: 'card-shop', label: 'goto.cardShop', icon: ShoppingBag, screens: ['card-shop', 'lok-shop', 'vendor', 'workshop'] },
  { id: 'settings', label: 'goto.settings', icon: Settings, screens: ['settings'] },
];

interface Props {
  screenName: string;
  onGo: (id: string) => void;
}

/** Always-there navigation for menu screens: bottom bar on phones, a slim rail on larger screens. */
export function MenuDock({ screenName, onGo }: Props) {
  const t = useT();
  const itemClass = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-[color,background-color,transform] duration-[var(--dur-fast)] active:scale-95 sm:min-h-12 sm:w-full sm:flex-none sm:py-2 ${
      active ? 'bg-primary/15 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'
    }`;
  return (
    <nav
      aria-label={t('goto.dockLabel')}
      className="fixed inset-x-0 bottom-0 z-[100] flex border-t border-white/15 bg-black/85 pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:w-20 sm:flex-col sm:justify-center sm:border-r sm:border-t-0 sm:pb-0 sm:pr-0"
      data-testid="menu-dock"
    >
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
    </nav>
  );
}
