/**
 * The Kinetic Bender room.
 *
 * The shopping list of reality-benders. These are not stat shelves — each kit
 * changes what a run *is* — so they live apart from the Quartermaster and only
 * one is carried at a time. Locked kits stay on the wall with their unlock
 * spelled out, the same way every other locked surface in the game reads.
 */

import { Hand, Hourglass, Lock } from 'lucide-react';

import { KINETIC_KITS } from '@/game/data/kinetic';
import { describeUnlock, isUnlocked, useMeta } from '@/game/state/metaStore';
import type { KineticKitDef, KineticKitId } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';

export interface KineticBenderPanelProps {
  onBack: () => void;
}

const KIT_ICONS: Record<KineticKitId, typeof Hand> = {
  'kinetic-throw': Hand,
  'time-stop': Hourglass,
};

function formatCost(kit: KineticKitDef): string {
  return kit.currency === 'skeletonKeys'
    ? `${kit.cost} skeleton key${kit.cost === 1 ? '' : 's'}`
    : `${kit.cost.toLocaleString()} cred`;
}

export function KineticBenderPanel({ onBack }: KineticBenderPanelProps) {
  const { meta, buyKineticKit, equipKineticKit } = useMeta();

  return (
    <ScreenLayout title="Kinetic Bender" subtitle="Specials that bend the street" onBack={onBack}>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Pick a kit up once and it is yours. Only one rides along on a run — fire it with{' '}
          <span className="font-mono text-foreground">Q</span> or the dial beside your ultimate.
        </p>
        <div className="ml-auto flex gap-3 font-mono text-xs uppercase tracking-widest">
          <span data-testid="text-kinetic-cred">{meta.cred.toLocaleString()} cred</span>
          <span className="text-primary" data-testid="text-kinetic-keys">{meta.skeletonKeys} keys</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2" data-testid="grid-kinetic-kits">
        {KINETIC_KITS.map((kit) => {
          const unlocked = isUnlocked(kit.unlock, meta);
          const owned = meta.ownedKineticKitIds.includes(kit.id);
          const equipped = meta.equippedKineticKitId === kit.id;
          const affordable = meta[kit.currency] >= kit.cost;
          const Icon = KIT_ICONS[kit.id];

          return (
            <article
              key={kit.id}
              className={`flex flex-col gap-3 border p-4 ${
                equipped ? 'border-primary/70 bg-primary/5' : unlocked ? 'border-border' : 'border-border/50 opacity-70'
              }`}
              data-testid={`card-kinetic-${kit.id}`}
            >
              <header className="flex items-start gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center border"
                  style={{ borderColor: `${kit.accent}66`, color: kit.accent }}
                >
                  {unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold uppercase tracking-wide" style={{ color: kit.accent }}>
                    {kit.name}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{kit.tagline}</p>
                </div>
                {equipped ? (
                  <span className="ml-auto shrink-0 border border-primary/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                    Carried
                  </span>
                ) : null}
              </header>

              <p className="text-sm text-muted-foreground">{kit.description}</p>
              <p className="text-xs italic text-muted-foreground/70">{kit.flavor}</p>

              <dl className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <div>
                  <dt className="text-muted-foreground/60">Cooldown</dt>
                  <dd className="text-foreground">{(kit.cooldownMs / 1000).toFixed(0)}s</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground/60">{kit.durationMs > 0 ? 'Duration' : 'Effect'}</dt>
                  <dd className="text-foreground">{kit.durationMs > 0 ? `${(kit.durationMs / 1000).toFixed(0)}s` : 'Instant'}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-wrap items-center gap-2">
                {!unlocked ? (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Locked · {describeUnlock(kit.unlock)}
                  </span>
                ) : !owned ? (
                  <button
                    type="button"
                    onClick={() => buyKineticKit(kit.id)}
                    disabled={!affordable}
                    className="border border-primary/50 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary disabled:opacity-40"
                    data-testid={`button-buy-kinetic-${kit.id}`}
                  >
                    Pick up · {formatCost(kit)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => equipKineticKit(equipped ? null : kit.id)}
                    className="border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest hover:border-primary hover:text-primary"
                    data-testid={`button-equip-kinetic-${kit.id}`}
                  >
                    {equipped ? 'Leave it here' : 'Carry this'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
