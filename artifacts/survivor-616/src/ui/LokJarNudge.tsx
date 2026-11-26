/**
 * The calm Boost Jar notice shown at the end of a run. Rules (cap per day, gaps, one per milestone, no pressure
 * wording) live in the SDK jarNudge module; this only reads the server jar, keeps the small memory on this device
 * and draws one quiet strip with two equal choices. It renders nothing when there is nothing to say.
 */
import { useEffect, useState } from 'react';
import { jarNudge, newNudgeMemory, type JarNudgeMemory, type Nudge } from '../../../../lib/lok-universe/src/jarNudge';
import { nudgeInputFromServer } from '../../../../lib/lok-universe/src/jarClient';
import { useLokEconomy } from '@/state/lokEconomyStore';
import { useT } from '@/lib/i18n';

const KEY = 'survivor616.jarNudge.v1';
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const load = (day: string): JarNudgeMemory => { try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as JarNudgeMemory) : newNudgeMemory(day); } catch { return newNudgeMemory(day); } };
const save = (m: JarNudgeMemory) => { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* storage unavailable: nudges just may repeat */ } };

export function LokJarNudge({ onOpenShop }: { onOpenShop?: () => void }) {
  const t = useT();
  const { signedIn, jar, refreshJar } = useLokEconomy();
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [asked, setAsked] = useState(false);

  // The run just ended, which is a natural pause: refresh once so the numbers include this run.
  useEffect(() => { if (signedIn) void refreshJar().then(() => setAsked(true)); }, [signedIn, refreshJar]);
  useEffect(() => {
    if (!asked || !jar) return;
    const day = dayKey();
    const result = jarNudge(load(day), nudgeInputFromServer(jar), Date.now(), day, true);
    save(result.memory);
    setNudge(result.nudge);
  }, [asked, jar]);

  if (!nudge) return null;
  return (
    <aside className="lokshop-holo flex flex-wrap items-center gap-3 p-3" role="status" data-testid="lokjar-nudge">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-cyan-300">{nudge.title}</p>
        <p className="mt-1 text-xs">{nudge.body}</p>
      </div>
      <div className="flex gap-2">
        {onOpenShop ? (
          <button type="button" onClick={onOpenShop} className="border border-cyan-300 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 active:translate-y-px" data-testid="button-lokjar-nudge-open">{nudge.primary.label}</button>
        ) : null}
        <button type="button" onClick={() => setNudge(null)} className="border border-violet-300/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-violet-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 active:translate-y-px" data-testid="button-lokjar-nudge-dismiss">{nudge.secondary.label}</button>
      </div>
    </aside>
  );
}
