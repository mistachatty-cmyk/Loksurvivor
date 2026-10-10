import { CHARACTERS } from '@/game/data/characters';
import { BOOSTER_GROUP_LABEL, BOOSTER_PRODUCTS, BOOSTER_STAT_BY_KEY, describeBooster } from '@/game/data/boosterCards';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import type { BoosterCardRecord } from '@/game/types';
import { RigPortrait } from './RigPortrait';

/** The "Bootleg Booster Bin" at the top of the vendor. Ghosted copies stack into the stats of every run. */
export function BoosterBin() {
  const t = useT();
  const { meta, buyBoosterProduct } = useMeta();

  return (
    <section className="terminal-frame border border-border bg-card p-5 sm:p-6" data-testid="section-booster-bin">
      <div className="mb-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-primary">{t('booster.eyebrow')}</p>
        <h2 className="mt-1 text-2xl font-black text-white">{t('booster.title')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t('booster.intro')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {BOOSTER_PRODUCTS.map((product) => {
          const affordable = meta.cardCredits >= product.cost;
          return (
            <article key={product.id} className="flex flex-col gap-3 border border-border bg-background/40 p-4" data-testid={`button-booster-${product.id}`}>
              <div>
                <h3 className="text-base font-black text-white">{product.name}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{product.blurb}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t('booster.cardCount', { count: product.cards })}</p>
              </div>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => buyBoosterProduct(product.id)}
                className="mt-auto border border-primary/50 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {affordable ? t('booster.buy', { cost: product.cost }) : t('booster.need', { cost: product.cost })}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-6">
        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('booster.ownedTitle', { count: meta.boosterCards.length })}</p>
        {meta.boosterCards.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {meta.boosterCards.map((card) => <GhostBoosterCard key={card.id} card={card} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('booster.empty')}</p>
        )}
      </div>
    </section>
  );
}

/** A booster card: a faded copy of a character with its boost printed across the bottom. */
function GhostBoosterCard({ card }: { card: BoosterCardRecord }) {
  const t = useT();
  const character = CHARACTERS.find((entry) => entry.id === card.characterId);
  return (
    <article className="relative flex flex-col items-center gap-2 overflow-hidden border border-dashed border-primary/40 bg-background/60 p-3" data-testid={`booster-card-${card.id}`}>
      <div className="pointer-events-none opacity-30 grayscale" aria-hidden="true">
        {character ? <RigPortrait rig={character.rig} palette={character.palette} size={72} animated={false} /> : null}
      </div>
      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t('booster.ghostLabel')}</p>
      <p className="text-center text-xs font-black text-white">{describeBooster(card)}</p>
      <p className="text-center font-mono text-[9px] uppercase tracking-widest text-primary/80">
        {BOOSTER_GROUP_LABEL[card.group]} · {BOOSTER_STAT_BY_KEY[card.stat].label}
      </p>
    </article>
  );
}
