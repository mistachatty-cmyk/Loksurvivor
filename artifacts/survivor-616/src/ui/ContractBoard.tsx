import { Check, CircleDot, Coins, Radio, Target } from 'lucide-react';

import { useMeta } from '@/game/state/metaStore';
import type { DailyContractStatus } from '@/game/types';

export interface ContractBoardProps {
  onHeadOut: () => void;
}

function progressLabel(contract: DailyContractStatus): string {
  if (contract.kind === 'clear-area') return contract.completed ? 'Block cleared' : 'Clear any district';
  if (contract.kind === 'survive-sec') return `${contract.progress}/${contract.targetCount}s`;
  return `${contract.progress}/${contract.targetCount}`;
}

function ContractCard({ contract }: { contract: DailyContractStatus }) {
  const progressPct = Math.min(100, (contract.progress / Math.max(1, contract.targetCount)) * 100);
  return (
    <article
      className={`border p-3 ${contract.completed ? 'border-primary/60 bg-primary/10' : 'border-border bg-black/20'}`}
      data-testid={`daily-contract-${contract.id.split(':').at(-1)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {contract.completed ? (
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <Target className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          )}
          <h3 className="truncate text-sm font-black uppercase tracking-wide text-white">{contract.name}</h3>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          {contract.completed ? 'Paid' : `+${contract.rewardCred} cred`}
        </span>
      </div>
      <p className="mt-2 min-h-9 text-xs leading-relaxed text-muted-foreground">{contract.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-white/10" aria-hidden="true">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-white/70">
          {progressLabel(contract)}
        </span>
      </div>
      {contract.rewardTokens > 0 && !contract.completed ? (
        <p className="mt-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-amber-300/80">
          <Coins className="h-3 w-3" aria-hidden="true" /> +{contract.rewardTokens} loot token
        </p>
      ) : null}
    </article>
  );
}

export function ContractBoard({ onHeadOut }: ContractBoardProps) {
  const { dailyContracts, meta } = useMeta();
  const completed = dailyContracts.filter((contract) => contract.completed).length;

  return (
    <section className="mb-8 border border-cyan-200/35 bg-cyan-950/15 p-4 sm:p-5" data-testid="section-contract-board">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center border border-cyan-200/45 bg-cyan-200/10 text-cyan-100">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200">The Broadcast Board</p>
            <h2 className="mt-1 text-2xl font-black uppercase text-white">Three signals for today</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The city is making requests. Complete runs to turn the signal into Cred.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:text-right">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-100/60">{meta.dailyContractDayKey}</p>
            <p className="mt-1 font-mono text-xs font-bold uppercase tracking-widest text-white">{completed}/{dailyContracts.length} paid</p>
          </div>
          <button
            type="button"
            onClick={onHeadOut}
            className="border border-cyan-200/50 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-100 transition-colors hover:bg-cyan-200 hover:text-cyan-950"
            data-testid="button-contract-board-head-out"
          >
            Head out
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {dailyContracts.map((contract) => <ContractCard key={contract.id} contract={contract} />)}
      </div>
      <p className="mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-cyan-100/50">
        <CircleDot className="h-3 w-3" aria-hidden="true" />
        Board refreshes at local midnight · progress carries across runs
      </p>
    </section>
  );
}

export default ContractBoard;