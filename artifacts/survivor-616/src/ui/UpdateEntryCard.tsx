import { Bug, Globe2, Megaphone, Wrench } from 'lucide-react';

import { updateNumber, type ChangelogEntry } from '@/game/data/changelog';
import { CHANGELOG_KIND_META, type ChangelogKind } from '@/game/data/changelogKinds';

const KIND_ICONS = { bugfix: Bug, hotfix: Wrench, update: Megaphone, expansion: Globe2 } satisfies Record<ChangelogKind, typeof Bug>;

/** One palette and one voice per release kind, shared by every Updates surface. */
export function UpdateEntryCard({ entry, testId, roomy = false }: { entry: ChangelogEntry; testId: string; roomy?: boolean }) {
  const kind = CHANGELOG_KIND_META[entry.kind];
  const Icon = KIND_ICONS[entry.kind];

  return (
    <article
      className={`border ${roomy ? 'p-4' : 'p-3'}`}
      style={{ borderColor: `${kind.color}99`, backgroundColor: `${kind.color}12`, boxShadow: `inset 3px 0 0 ${kind.color}, 0 0 22px ${kind.color}12` }}
      data-testid={testId}
      data-update-kind={entry.kind}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest"
          style={{ borderColor: kind.color, backgroundColor: `${kind.color}26`, color: kind.color }}
        >
          <Icon className="h-2.5 w-2.5" /> {kind.label} #{updateNumber(entry)}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">v{entry.version} · {entry.date}</span>
      </div>
      <h3 className="mt-1.5 text-sm font-black uppercase text-white">{entry.title}</h3>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wide" style={{ color: kind.color }}>{kind.lore}</p>
      <ul className="mt-1.5 space-y-1">
        {entry.body.map((line) => (
          <li key={line} className="text-xs leading-snug text-muted-foreground">{line}</li>
        ))}
      </ul>
    </article>
  );
}
