import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useT, type MessageKey } from '@/lib/i18n';

/** A destination the palette can jump to. `feature` ties it to a hub-room feature so locked rooms stay locked. */
export interface GoToTarget {
  id: string;
  label: MessageKey;
  group: MessageKey;
  keywords: string;
  /** Hub-room feature that must be unlocked; omit for always-available screens. */
  feature?: string;
}

export const GO_TO_TARGETS: GoToTarget[] = [
  { id: 'hub', label: 'goto.hub', group: 'goto.group.play', keywords: 'home hideout main base' },
  { id: 'areas', label: 'goto.areas', group: 'goto.group.play', keywords: 'run play start map level area head out', feature: 'runs' },
  { id: 'roster', label: 'goto.roster', group: 'goto.group.play', keywords: 'character operative hero select', feature: 'roster' },
  { id: 'looks', label: 'goto.looks', group: 'goto.group.play', keywords: 'cosmetics lokpet pet appearance skin' },
  { id: 'bestiary', label: 'goto.bestiary', group: 'goto.group.collect', keywords: 'enemies monsters codex', feature: 'bestiary' },
  { id: 'archive', label: 'goto.archive', group: 'goto.group.collect', keywords: 'unlocks registry collection lore', feature: 'unlocks' },
  { id: 'recovery', label: 'goto.recovery', group: 'goto.group.collect', keywords: 'heal recover revive', feature: 'recovery' },
  { id: 'vendor', label: 'goto.vendor', group: 'goto.group.collect', keywords: 'buy shop store items', feature: 'vendor' },
  { id: 'workshop', label: 'goto.workshop', group: 'goto.group.collect', keywords: 'craft upgrade relic', feature: 'workshop' },
  { id: 'card-shop', label: 'goto.cardShop', group: 'goto.group.collect', keywords: 'cards packs deck shop' },
  { id: 'palette-store', label: 'goto.paletteStore', group: 'goto.group.collect', keywords: 'themes colors palettes auras hats', feature: 'palette-store' },
  { id: 'weapon-bans', label: 'goto.weaponBans', group: 'goto.group.collect', keywords: 'ban weapons loadout' },
  { id: 'music', label: 'goto.music', group: 'goto.group.hideout', keywords: 'songs soundtrack playlist audio', feature: 'music' },
  { id: 'studio', label: 'goto.studio', group: 'goto.group.hideout', keywords: 'beat maker compose make music', feature: 'studio' },
  { id: 'sound-booth', label: 'goto.soundBooth', group: 'goto.group.hideout', keywords: 'sfx sounds effects', feature: 'sound-booth' },
  { id: 'settings', label: 'goto.settings', group: 'goto.group.system', keywords: 'options controls accessibility language motion graphics volume' },
  { id: 'account', label: 'goto.account', group: 'goto.group.system', keywords: 'sign in login profile' },
  { id: 'feedback', label: 'goto.feedback', group: 'goto.group.system', keywords: 'report bug suggest contact' },
];

interface Props {
  /** Features reachable in rooms the player has unlocked. */
  unlockedFeatures: ReadonlySet<string>;
  /** Hidden on screens where a stray key press would cost the player (an active run). */
  disabled?: boolean;
  onGo: (id: string) => void;
}

function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName));
}

/** "Go to" search: Ctrl/Cmd-K or `/` opens it from anywhere outside a run. */
export function GoToPalette({ unlockedFeatures, disabled, onGo }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !isTyping(event.target))) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const groups = Array.from(new Set(GO_TO_TARGETS.map((target) => target.group)));
  return (
    <>
      {!disabled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('goto.open')}
          title={`${t('goto.open')} (${t('goto.hint')})`}
          className="fixed bottom-[max(0.75rem,var(--safe-bottom))] right-[max(0.75rem,var(--safe-right))] z-[105] hidden min-h-11 items-center gap-2 border border-white/20 bg-black/70 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur transition hover:border-primary hover:text-white active:scale-95 sm:inline-flex"
          data-testid="button-go-to"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('goto.open')}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0" data-testid="go-to-palette">
          <DialogTitle className="sr-only">{t('goto.open')}</DialogTitle>
          <DialogDescription className="sr-only">{t('goto.placeholder')}</DialogDescription>
          <Command>
            <CommandInput placeholder={t('goto.placeholder')} data-testid="input-go-to" />
            <CommandList>
              <CommandEmpty>{t('goto.empty')}</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group} heading={t(group)}>
                  {GO_TO_TARGETS.filter((target) => target.group === group).map((target) => {
                    const locked = !!target.feature && !unlockedFeatures.has(target.feature);
                    return (
                      <CommandItem
                        key={target.id}
                        value={`${t(target.label)} ${target.keywords}`}
                        disabled={locked}
                        onSelect={() => {
                          setOpen(false);
                          onGo(target.id);
                        }}
                        data-testid={`go-to-${target.id}`}
                      >
                        {t(target.label)}
                        {locked && <span className="ml-auto text-xs text-muted-foreground">🔒</span>}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
