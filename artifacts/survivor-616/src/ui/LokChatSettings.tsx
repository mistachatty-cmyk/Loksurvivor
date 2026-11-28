import { useSyncExternalStore } from 'react';

import { CHAT_FEATURES, type ChatFeature } from '@lok/chat';

import { useT } from '@/lib/i18n';
import { lokChatFeatureAllowed, lokChatFeatureOn, onLokChatSettingChange, setLokChatFeature } from '@/lib/lokChatSetting';

const btn = (active: boolean) => `border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${active ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100' : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'}`;

function FeatureRow({ feature }: { feature: ChatFeature }) {
  const t = useT();
  const value = useSyncExternalStore(onLokChatSettingChange, () => lokChatFeatureOn(feature), () => true);
  const title = t(`lokChat.settings.feature.${feature}.title` as never);
  return (
    <div className="mt-4" data-testid={`lok-chat-feature-${feature}`}>
      <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t(`lokChat.settings.feature.${feature}.description` as never)}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={title}>
        {[true, false].map((on) => (
          <button key={String(on)} type="button" aria-pressed={value === on} className={btn(value === on)} onClick={() => setLokChatFeature(feature, on)} data-testid={`button-lok-chat-${feature}-${on ? 'on' : 'off'}`}>
            {t(on ? 'lokChat.settings.on' : 'lokChat.settings.off')}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Settings > LOK Chat: every part of the chat and crew chatter can be turned off on its own. */
export function LokChatSettings() {
  const t = useT();
  return (
    <section id="settings-lok-chat" className="scroll-mt-24 border border-border bg-card p-5 sm:p-6 lg:[column-span:all]" data-testid="settings-lok-chat">
      <h2 className="text-xl font-black uppercase text-white">{t('lokChat.settings.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('lokChat.settings.description')}</p>
      {CHAT_FEATURES.filter(lokChatFeatureAllowed).map((feature) => <FeatureRow key={feature} feature={feature} />)}
    </section>
  );
}
