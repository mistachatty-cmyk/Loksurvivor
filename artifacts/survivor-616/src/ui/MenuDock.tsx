import { CrewButton } from './CrewOverlay';
import { Fragment, useEffect, useRef } from 'react';
import { ArrowRight, Backpack, Home, Map, MessageSquare, Search, Settings, ShoppingBag, Store, Users, type LucideIcon } from 'lucide-react';

import { useMeta } from '@/game/state/metaStore';
import { totalUnread, useLokChat } from '@/game/state/lokChatStore';
import { openLokChat, useLokChatOpen } from '@/lib/lokChatOpen';
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
  { id: 'areas', label: 'dock.map', icon: Map, screens: pageScreens('areas') },
  { id: 'roster', label: 'goto.roster', icon: Users, screens: pageScreens('roster') },
  { id: 'card-shop', label: 'dock.cards', icon: ShoppingBag, screens: pageScreens('card-shop') },
  { id: 'inventory', label: 'dock.items', icon: Backpack, screens: pageScreens('inventory') },
  { id: 'lok-shop', label: 'goto.lokShop', icon: Store, screens: pageScreens('lok-shop') },
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
  const navRef = useRef<HTMLElement>(null);
  const chatOpen = useLokChatOpen().open;
  const chatUnread = useLokChat(totalUnread);
  const mailUnread = meta.trainingMailbox.filter((entry) => !entry.read).length;
  const chatBadge = chatUnread + mailUnread;
  const sealedPacks = Object.values(meta.unopenedCardPacks).reduce<number>((sum, qty) => sum + (qty ?? 0), 0);

  // Tell the pages how much room the dock takes, so nothing at the bottom of a page hides behind it:
  // a bar along the bottom on a phone, a slim rail down the left on a wide screen.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const measure = () => {
      const box = nav.getBoundingClientRect();
      const rail = box.width < window.innerWidth * 0.5;
      root.style.setProperty('--menu-dock-h', rail ? '0px' : `${Math.ceil(box.height)}px`);
      root.style.setProperty('--menu-dock-w', rail ? `${Math.ceil(box.width)}px` : '0px');
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(nav);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      root.style.setProperty('--menu-dock-h', '0px');
      root.style.setProperty('--menu-dock-w', '0px');
    };
  }, []);

  const itemClass = (active: boolean) =>
    `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 font-mono text-[8.5px] tracking-tight min-[400px]:text-[9px] sm:text-[10px] sm:tracking-wider font-bold uppercase transition-[color,background-color,transform] duration-[var(--dur-fast)] active:scale-95 sm:min-h-12 sm:w-full sm:flex-none sm:py-2 ${
      active ? 'bg-primary/15 text-primary' : 'text-white/60 hover:bg-white/5 hover:text-white'
    }`;
  return (
    <nav
      ref={navRef}
      aria-label={t('goto.dockLabel')}
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-col border-t border-white/15 bg-black/90 pb-[var(--safe-bottom)] pl-[var(--safe-left)] pr-[var(--safe-right)] backdrop-blur sm:inset-x-auto sm:inset-y-0 sm:left-0 sm:w-20 sm:justify-center sm:border-r sm:border-t-0 sm:pb-0 sm:pr-0"
      data-testid="menu-dock"
    >
      <div className="flex items-stretch sm:flex-col">
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
      <CrewButton />
      </div>
      <div className="flex sm:flex-col">
      {ITEMS.map(({ id, label, icon: Icon, screens }) => {
        const active = screens.includes(screenName);
        return (
          <Fragment key={id}>
            <button type="button" onClick={() => onGo(id)} aria-current={active ? 'page' : undefined} className={itemClass(active)} data-testid={`dock-${id}`}>
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {id === 'inventory' && sealedPacks > 0 ? (
                  <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-fuchsia-500 px-1 text-center text-[9px] font-black leading-4 text-white" data-testid="dock-inventory-badge">{sealedPacks > 9 ? '9+' : sealedPacks}</span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{t(label)}</span>
            </button>
            {id === 'lok-shop' ? (
              <button
                type="button"
                onClick={() => openLokChat()}
                aria-haspopup="dialog"
                aria-label={chatBadge > 0 ? t('dock.chatAriaUnread', { count: chatBadge }) : t('dock.chatAria')}
                className={itemClass(chatOpen)}
                data-testid="dock-chat"
              >
                <span className="relative">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  {chatBadge > 0 ? (
                    <span className="absolute -right-2 -top-1.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[9px] font-black leading-4 text-white" data-testid="dock-chat-badge">{chatBadge > 9 ? '9+' : chatBadge}</span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{t('dock.chat')}</span>
              </button>
            ) : null}
          </Fragment>
        );
      })}
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_GO_TO_EVENT))} className={`${itemClass(false)} !flex-none w-11 sm:!w-full`} aria-label={t('goto.search')} data-testid="dock-search">
        <Search className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:max-w-full sm:truncate">{t('goto.search')}</span>
      </button>
      </div>
    </nav>
  );
}
