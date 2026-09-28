/**
 * Tap-to-reveal explainer for the Hideout's currencies. The Session Stats
 * block also carries `title` tooltips for desktop hover, but hover doesn't
 * exist on a touch screen -- this is the version a mobile player can
 * actually reach.
 */
import { Coins, Package, KeyRound, Sparkles } from 'lucide-react';

const ENTRIES = [
  {
    icon: Coins,
    color: 'text-amber-300',
    name: 'Cred',
    description: "The main currency. Earned per run, spent at the Quartermaster, Relic Workshop, and most other rooms.",
  },
  {
    icon: Package,
    color: 'text-amber-400',
    name: 'Loot tokens',
    description: 'Earned from runs. Spent at the Customization Shop on palettes and run auras.',
  },
  {
    icon: KeyRound,
    color: 'text-sky-400',
    name: 'Skeleton keys',
    description: "Rarer drops. Spent at the Quartermaster on things cred alone can't buy.",
  },
  {
    icon: Sparkles,
    color: 'text-violet-300',
    name: 'LokTokens',
    description: 'Your account-linked balance, tied to sign-in rather than this device\'s save. Managed from Account.',
  },
] as const;

export function CurrencyGlossary() {
  return (
    <div className="mt-3 border border-border bg-card/80 p-3 text-left" data-testid="currency-glossary">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What's what</p>
      <ul className="space-y-2">
        {ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <li key={entry.name} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${entry.color}`} aria-hidden="true" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className={`font-bold ${entry.color}`}>{entry.name}</span> — {entry.description}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CurrencyGlossary;
