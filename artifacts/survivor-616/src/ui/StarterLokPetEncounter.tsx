import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, PackageOpen, Sparkles, Swords, Zap } from 'lucide-react';

import { LOKPET_VARIANTS_BY_ID, STARTER_LOKPET_IDS, type StarterLokPetId } from '@/game/data/lokPets';
import { useMeta } from '@/game/state/metaStore';
import { LokPetIcon } from '@/ui/LokPetVariantSheet';

type Phase = 'fists' | 'rustle' | 'choose' | 'partner' | 'victory';

const STARTER_DETAILS: Record<StarterLokPetId, { role: string; active: string; passive: string; evolution: string }> = {
  'lil-llama': {
    role: 'Crowd-control guardian',
    active: 'Cutify charms nearby enemies. They trail your partner with hearts overhead and body-block their old crew.',
    passive: 'Getaway blasts a crowded ring backward. More targets and stronger knockback unlock as Lil Llamà levels.',
    evolution: 'Cria → Street Llama → Heartguard Llama',
  },
  'static-null': {
    role: 'Growing data predator',
    active: 'Data Feast consumes hostile code in a damaging null burst. Its reach and appetite grow every level.',
    passive: 'Quiet Tithe boosts the burst by borrowing a sliver of your energy—never enough to finish you.',
    evolution: 'Data Mote → Null Familiar → Nomad-Eater Echo',
  },
  'lil-buzbee': {
    role: 'Loot scout and field medic',
    active: 'Item Scout zips out to gather more nearby drops as it levels, then sweeps the whole local field at level 99.',
    passive: 'Boost Pollen grants speed and 1.5× healing while inside; the effect lingers for 1.5 seconds after leaving.',
    evolution: 'Runt Bee → Courier Bee → Royal Buzbèè',
  },
};

export function StarterLokPetEncounter({ onEnterHideout }: { onEnterHideout: () => void }) {
  const { completeStarterLokPetOnboarding } = useMeta();
  const [phase, setPhase] = useState<Phase>('fists');
  const [enemyHp, setEnemyHp] = useState(100);
  const [inspected, setInspected] = useState<StarterLokPetId | null>(null);
  const [chosen, setChosen] = useState<StarterLokPetId | null>(null);
  const [hits, setHits] = useState(0);
  const selected = inspected ? LOKPET_VARIANTS_BY_ID[inspected] : null;
  const chosenVariant = chosen ? LOKPET_VARIANTS_BY_ID[chosen] : null;
  const phaseCopy = useMemo(() => {
    if (phase === 'fists') return 'No deck. No weapon. Just get through the block.';
    if (phase === 'rustle') return 'Something digital is moving in the brush.';
    if (phase === 'choose') return inspected ? 'Signal identified. Choose carefully—this partner stays with you.' : 'Three unknown signals answer. Touch one to reveal it.';
    if (phase === 'partner') return `${chosenVariant?.name ?? 'Your partner'} is with you. Finish the fight.`;
    return 'First night survived. Your partner is coming home.';
  }, [chosenVariant?.name, inspected, phase]);

  const punch = () => {
    const nextHits = hits + 1;
    const nextHp = Math.max(42, enemyHp - 19);
    setHits(nextHits);
    setEnemyHp(nextHp);
    if (nextHits >= 3) setPhase('rustle');
  };

  const partnerStrike = () => {
    const next = Math.max(0, enemyHp - 24);
    setEnemyHp(next);
    if (next === 0 && chosen) {
      completeStarterLokPetOnboarding(chosen);
      setPhase('victory');
    }
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-black text-white" data-testid="starter-lokpet-encounter">
      <div className="absolute inset-0 bg-cover bg-center opacity-35" style={{ backgroundImage: "url('/art/alley.jpeg')" }} aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_52%,rgba(34,211,238,.16),transparent_22%),linear-gradient(to_bottom,rgba(0,0,0,.32),rgba(0,0,0,.92))]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-start justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.32em] text-orange-300">First arrival · en route to the hideout</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-4xl">The Block Has Teeth</h1>
            <p className="mt-2 max-w-xl text-sm text-white/60">{phaseCopy}</p>
          </div>
          <span className="border border-white/15 bg-black/50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white/55">Unarmed</span>
        </header>

        <section className="relative my-5 min-h-[250px] flex-1 overflow-hidden border border-white/15 bg-black/45 p-4 sm:min-h-[330px] sm:p-7">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(transparent,rgba(249,115,22,.08))]" />
          <div className="relative flex h-full min-h-[220px] items-end justify-between gap-4">
            <motion.div animate={{ x: phase === 'partner' ? [0, 7, 0] : 0 }} className="w-28 sm:w-40">
              <div className="mx-auto grid h-20 w-16 place-items-center border-2 border-white/50 bg-zinc-900 text-3xl">✊</div>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-white/60">You · fists</p>
            </motion.div>

            <AnimatePresence>
              {(phase === 'rustle' || phase === 'choose') && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: .8 }}
                  animate={{ opacity: 1, x: '-50%', scale: [1, 1.04, 1], rotate: [-1, 1, -1] }}
                  exit={{ opacity: 0, scale: .8 }}
                  transition={{ scale: { repeat: Infinity, duration: 1.4 }, rotate: { repeat: Infinity, duration: .35 } }}
                  onClick={() => setPhase('choose')}
                  className="absolute bottom-8 left-1/2 -translate-x-1/2 border border-cyan-300/60 bg-cyan-950/70 px-5 py-4 text-center shadow-[0_0_28px_rgba(34,211,238,.25)]"
                  data-testid="button-investigate-bush"
                >
                  <Sparkles className="mx-auto h-6 w-6 text-cyan-200" />
                  <span className="mt-2 block font-mono text-[9px] font-black uppercase tracking-[.22em] text-cyan-100">Digital rustle</span>
                </motion.button>
              )}
            </AnimatePresence>

            {chosenVariant && phase !== 'victory' && (
              <motion.div initial={{ opacity: 0, y: 28, scale: .7 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute bottom-6 left-[34%]">
                <LokPetIcon silhouette={chosenVariant.silhouette} palette={chosenVariant.palette} size={72} className="bg-black/65" />
                <p className="mt-2 text-center font-mono text-[9px] font-black uppercase text-cyan-200">Partner</p>
              </motion.div>
            )}

            <motion.div animate={phase === 'partner' ? { x: [0, 12, -7, 0] } : { x: 0 }} className="w-32 sm:w-44">
              <div className="mx-auto grid h-24 w-20 place-items-center border-2 border-red-400/60 bg-red-950/70 text-4xl">☠</div>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-red-200">Block scavenger</p>
              <div className="mt-2 h-2 overflow-hidden bg-white/10"><motion.div className="h-full bg-red-400" animate={{ width: `${enemyHp}%` }} /></div>
            </motion.div>
          </div>
        </section>

        {phase === 'fists' && (
          <button type="button" onClick={punch} className="mx-auto flex min-h-14 w-full max-w-sm items-center justify-center gap-3 bg-orange-400 px-6 py-4 text-sm font-black uppercase tracking-[.18em] text-black active:scale-[.98]" data-testid="button-starter-punch">
            <Swords className="h-5 w-5" /> Throw a punch
          </button>
        )}

        {phase === 'rustle' && <p className="text-center font-mono text-xs uppercase tracking-[.25em] text-cyan-200">Tap the signal in the brush</p>}

        {phase === 'choose' && (
          <div className="fixed inset-0 z-30 overflow-y-auto bg-black/90 p-4 backdrop-blur-md sm:p-8">
            <div className="mx-auto max-w-5xl">
              <p className="text-center font-mono text-[10px] font-black uppercase tracking-[.32em] text-cyan-200">Choose your first LokPet</p>
              <h2 className="mt-2 text-center text-3xl font-black uppercase">Three signals. One partner.</h2>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {STARTER_LOKPET_IDS.map((id, index) => {
                  const variant = LOKPET_VARIANTS_BY_ID[id];
                  const open = inspected === id;
                  return (
                    <motion.button key={id} type="button" onClick={() => setInspected(id)} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: [0, -4, 0] }} transition={{ delay: index * .1, y: { repeat: Infinity, duration: 2 + index * .25 } }} className={`min-h-72 border p-5 text-left transition ${open ? 'border-cyan-200 bg-cyan-400/10' : 'border-white/15 bg-white/[.035]'}`} data-testid={`button-starter-${id}`}>
                      <div className={`mx-auto w-fit transition duration-500 ${open ? '' : 'brightness-0 opacity-55'}`}>
                        <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} size={88} className="bg-black/60" />
                      </div>
                      <p className="mt-5 font-mono text-[9px] uppercase tracking-[.25em] text-white/45">Signal 0{index + 1}</p>
                      <h3 className="mt-1 text-xl font-black uppercase">{open ? variant.name : 'Unknown LokPet'}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/55">{open ? STARTER_DETAILS[id].role : 'Animated silhouette · identity encrypted'}</p>
                    </motion.button>
                  );
                })}
              </div>

              {selected && inspected && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 border border-cyan-300/30 bg-cyan-950/25 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <p className="text-sm leading-relaxed text-white/75"><Heart className="mr-2 inline h-4 w-4 text-pink-300" />{STARTER_DETAILS[inspected].active}</p>
                    <p className="text-sm leading-relaxed text-white/75"><Zap className="mr-2 inline h-4 w-4 text-amber-300" />{STARTER_DETAILS[inspected].passive}</p>
                  </div>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-cyan-200">3 forms · level 99 max · {STARTER_DETAILS[inspected].evolution}</p>
                  <button type="button" onClick={() => { setChosen(inspected); setPhase('partner'); }} className="mt-5 w-full bg-cyan-200 px-5 py-4 text-xs font-black uppercase tracking-[.2em] text-slate-950 active:scale-[.99]" data-testid="button-confirm-starter">Choose {selected.name}</button>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {phase === 'partner' && (
          <button type="button" onClick={partnerStrike} className="mx-auto flex min-h-14 w-full max-w-sm items-center justify-center gap-3 bg-cyan-200 px-6 py-4 text-sm font-black uppercase tracking-[.16em] text-slate-950 active:scale-[.98]" data-testid="button-partner-strike">
            <Zap className="h-5 w-5" /> Fight together
          </button>
        )}

        {phase === 'victory' && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="border border-emerald-300/40 bg-emerald-950/30 p-5 text-center" data-testid="starter-rewards">
            <p className="font-mono text-[10px] font-black uppercase tracking-[.28em] text-emerald-200">Partner bonded · rewards secured</p>
            <h2 className="mt-2 text-2xl font-black uppercase">Welcome to the hideout, {chosenVariant?.name}</h2>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold uppercase tracking-wide">
              <span className="border border-white/15 px-3 py-2">First companion card</span>
              <span className="border border-white/15 px-3 py-2">2 free LokPacks</span>
              <span className="border border-white/15 px-3 py-2">40 Card Credits</span>
              <span className="border border-white/15 px-3 py-2">Hourly full refresh</span>
            </div>
            <button type="button" onClick={onEnterHideout} className="mt-5 inline-flex items-center gap-2 bg-orange-400 px-7 py-4 text-xs font-black uppercase tracking-[.2em] text-black active:scale-[.98]" data-testid="button-enter-hideout-after-starter"><PackageOpen className="h-5 w-5" /> Enter hideout & open packs</button>
          </motion.section>
        )}
      </div>
    </main>
  );
}

export default StarterLokPetEncounter;
