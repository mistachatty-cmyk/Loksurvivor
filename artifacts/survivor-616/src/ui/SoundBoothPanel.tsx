import { useState } from 'react';
import { Check, Disc3, Lock, Volume2 } from 'lucide-react';

import { hasCatalogItem } from '@/game/data/devUnlockRegistry';
import { SOUND_PACKS } from '@/game/data/soundPacks';
import { useAudioFrame } from '@/game/audio/useAudioFrame';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { useMeta } from '@/game/state/metaStore';
import type { CosmeticTier } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';

const TIER_BADGE_CLASS = {
  standard: 'border-white/15 text-white/65',
  uncommon: 'border-emerald-500/40 text-emerald-400',
  rare: 'border-sky-500/40 text-sky-400',
  legendary: 'border-amber-400/50 text-amber-300',
} satisfies Record<CosmeticTier, string>;

/** Played in sequence when previewing a pack -- a spread of cue shapes (impact, sweep, sustained) so the timbre reads clearly. */
const PREVIEW_CUES = ['hit', 'levelUp', 'ultimate'] as const;
const PREVIEW_STEP_MS = 260;

interface Props { onBack: () => void }

export function SoundBoothPanel({ onBack }: Props) {
  const { meta, buySoundPack, equipSoundPack, setSfxEnabled } = useMeta();
  const [notice, setNotice] = useState('Every pack only changes how it sounds -- never how it plays.');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  // Fixed on regardless of the gameplay sfxEnabled toggle: clicking Preview is
  // an explicit request to hear it, the same way palette preview ignores
  // nothing about the player's settings.
  const sfx = useSfxPlayer(SOUND_PACKS[0]!.style, true);
  const audioFrame = useAudioFrame();

  const handlePreview = (packId: string) => {
    const pack = SOUND_PACKS.find((entry) => entry.id === packId);
    if (!pack) return;
    setPreviewingId(packId);
    PREVIEW_CUES.forEach((cue, index) => {
      window.setTimeout(() => sfx.play(cue, false, pack.style), index * PREVIEW_STEP_MS);
    });
    window.setTimeout(() => setPreviewingId((current) => (current === packId ? null : current)), PREVIEW_CUES.length * PREVIEW_STEP_MS + 400);
  };

  const handleBuy = (packId: string) => {
    const pack = SOUND_PACKS.find((entry) => entry.id === packId);
    if (!pack || meta.ownedSoundPackIds.includes(pack.id) || meta.lootTokens < pack.cost) return;
    buySoundPack(pack.id);
    sfx.play('purchase', false, pack.style);
    setNotice(`${pack.name} purchased for ${pack.cost} loot token${pack.cost === 1 ? '' : 's'}.`);
  };

  return (
    <ScreenLayout title="The Sound Booth" subtitle="Reskin every hit, pickup and cue" onBack={onBack}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex shrink-0 flex-col items-center gap-3 border border-border bg-card px-6 py-5 lg:sticky lg:top-4 lg:w-72">
          <div className="grid h-16 w-16 place-items-center rounded-full border border-primary/50 bg-primary/10 text-primary">
            <Disc3 className="h-7 w-7" />
          </div>
          <p className="text-sm font-black uppercase tracking-wide text-white">Patch bay</p>
          <p className="w-full border border-primary/30 bg-primary/5 px-3 py-2 text-center">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Wallet</span>
            <span className="mt-1 block text-lg font-black text-primary" data-testid="text-sound-booth-token-balance">{meta.lootTokens} loot token{meta.lootTokens === 1 ? '' : 's'}</span>
          </p>
          <button
            type="button"
            onClick={() => setSfxEnabled(!meta.sfxEnabled)}
            aria-pressed={meta.sfxEnabled}
            className="w-full border border-border px-2 py-2 font-mono text-[8px] uppercase text-white/70"
            data-testid="button-sound-booth-toggle-sfx"
          >
            Gameplay SFX {meta.sfxEnabled ? 'on' : 'off'}
          </button>
          <p className="min-h-10 text-center text-[11px] leading-relaxed text-muted-foreground" aria-live="polite">{notice}</p>
        </aside>

        <section className="flex-1 border border-border bg-card p-5 sm:p-6" data-testid="section-sound-booth">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Procedural sound packs</p>
              <h2 className="mt-1 text-xl font-black uppercase text-white">Sound packs</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Every hit, pickup, level-up and menu click is synthesized live -- no licensed samples, ever. A pack only
                changes the timbre of those cues; combat, drops and pacing never change.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-3" data-testid="shop-sound-pack-grid">
                {SOUND_PACKS.map((pack) => {
                  const owned = hasCatalogItem(meta, 'soundPacks', pack.id, meta.ownedSoundPackIds);
                  const equipped = meta.activeSoundPackId === pack.id;
                  const affordable = meta.lootTokens >= pack.cost;
                  const previewing = previewingId === pack.id;
                  return (
                    <article
                      key={pack.id}
                      className={`border p-2.5 transition-transform sm:p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                      style={previewing ? {
                        transform: `scale(${1 + audioFrame.energy * 0.03})`,
                        boxShadow: `0 0 ${14 + audioFrame.energy * 18}px hsl(var(--primary) / ${0.15 + audioFrame.energy * 0.25})`,
                      } : undefined}
                      data-testid={`card-sound-pack-${pack.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{pack.name}</h3>
                        {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Equipped" /> : null}
                      </div>
                      <span className={`mt-2 inline-block border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest ${TIER_BADGE_CLASS[pack.tier ?? 'standard']}`}>{pack.tier ?? 'standard'}</span>
                      <p className="mt-2 min-h-12 text-xs leading-relaxed text-muted-foreground">{pack.description}</p>
                      <button
                        type="button"
                        onClick={() => handlePreview(pack.id)}
                        aria-pressed={previewing}
                        className={`mt-3 flex w-full items-center justify-center gap-1.5 border px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest ${previewing ? 'border-white/50 bg-white/10 text-white' : 'border-white/15 text-white/70 hover:border-white/40'}`}
                        data-testid={`button-preview-sound-pack-${pack.id}`}
                      >
                        <Volume2 className="h-3 w-3" />{previewing ? 'Playing…' : 'Preview'}
                      </button>
                      {owned ? (
                        <button type="button" onClick={() => { equipSoundPack(pack.id); setNotice(`${pack.name} equipped.`); }} disabled={equipped} className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${equipped ? 'cursor-default border-primary/40 text-primary/70' : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'}`} data-testid={`button-equip-sound-pack-${pack.id}`}>{equipped ? 'Equipped' : 'Equip'}</button>
                      ) : (
                        <button type="button" onClick={() => handleBuy(pack.id)} disabled={!affordable} className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${affordable ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground' : 'cursor-not-allowed border-border text-muted-foreground/50'}`} data-testid={`button-buy-sound-pack-${pack.id}`}>
                          {!affordable ? <Lock className="h-3 w-3" /> : null}{affordable ? `Buy · ${pack.cost} token${pack.cost === 1 ? '' : 's'}` : `Need ${pack.cost} tokens`}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </ScreenLayout>
  );
}

export default SoundBoothPanel;
