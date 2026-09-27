import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, PackageOpen, Shield, Sparkles, Swords, Zap } from 'lucide-react';

import { getEnemy } from '@/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID, STARTER_LOKPET_IDS, type StarterLokPetId } from '@/game/data/lokPets';
import { useMeta } from '@/game/state/metaStore';
import type { CharacterDef, EnemyDef } from '@/game/types';
import { LokPetIcon } from '@/ui/LokPetVariantSheet';
import { RigPortrait } from '@/ui/RigPortrait';

type Phase = 'fists' | 'rustle' | 'choose' | 'partner' | 'victory';

const STARTER_DETAILS: Record<StarterLokPetId, { role: string; active: string; passive: string; evolution: string }> = {
  'lil-llama': {
    role: 'Crowd-control guardian',
    active: 'Cutify charms nearby enemies into a heart-eyed escort that blocks its old crew.',
    passive: 'Getaway blasts a crowded ring backward, scaling its reach and force as Lil Llamà grows.',
    evolution: 'Cria → Street Llama → Heartguard Llama',
  },
  'static-null': {
    role: 'Growing data predator',
    active: 'Data Feast consumes hostile code in a damaging null burst that expands every level.',
    passive: 'Quiet Tithe strengthens the burst by borrowing a sliver of your energy, but can never finish you.',
    evolution: 'Data Mote → Null Familiar → Nomad-Eater Echo',
  },
  'lil-buzbee': {
    role: 'Loot scout and field medic',
    active: 'Item Scout gathers more nearby drops as it grows, then sweeps the local field at level 99.',
    passive: 'Boost Pollen grants speed and 1.5× healing, lingering for 1.5 seconds after you leave it.',
    evolution: 'Runt Bee → Courier Bee → Royal Buzbèè',
  },
};

function FighterModel({ character, hits }: { character: CharacterDef; hits: number }) {
  return (
    <motion.div
      key={hits}
      initial={hits > 0 ? { x: 0 } : false}
      animate={hits > 0 ? { x: [0, 22, 0], y: [0, -5, 0], rotate: [0, 3, 0] } : { y: [0, -5, 0], rotate: [-1, 1, -1] }}
      transition={hits > 0 ? { duration: .28 } : { duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
      className="relative mx-auto grid h-32 w-32 place-items-end drop-shadow-[0_0_24px_rgba(34,211,238,.35)]"
    >
      <RigPortrait rig={character.rig} palette={character.palette} anim={hits > 0 ? 'attack' : 'walk'} size={126} />
    </motion.div>
  );
}

function EnemyModel({ enemy, hp }: { enemy: EnemyDef; hp: number }) {
  return (
    <motion.div
      key={hp}
      initial={hp < 100 ? { x: 0, filter: 'brightness(2)' } : false}
      animate={hp < 100 ? { x: [0, 10, -7, 0], filter: ['brightness(2)', 'brightness(1)', 'brightness(1)'] } : { y: [0, -4, 0], rotate: [1, -1, 1] }}
      transition={hp < 100 ? { duration: .34 } : { duration: .94, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative mx-auto grid h-32 w-32 place-items-end drop-shadow-[0_0_24px_rgba(248,113,113,.32)] ${hp === 0 ? 'grayscale opacity-35' : ''}`}
    >
      <RigPortrait rig={enemy.rig} palette={enemy.palette} anim={hp === 0 ? 'hurt' : 'walk'} size={126} animated={hp > 0} />
    </motion.div>
  );
}

export function StarterLokPetEncounter({ onEnterHideout }: { onEnterHideout: () => void }) {
  const { completeStarterLokPetOnboarding, selectedCharacter, unlockedCharacters } = useMeta();
  const [starterCharacter] = useState<CharacterDef>(() => (
    unlockedCharacters[Math.floor(Math.random() * unlockedCharacters.length)] ?? selectedCharacter
  ));
  const enemy = useMemo(() => getEnemy('nightcrawler'), []);
  const [phase, setPhase] = useState<Phase>('fists');
  const [enemyHp, setEnemyHp] = useState(100);
  const [inspected, setInspected] = useState<StarterLokPetId | null>(null);
  const [chosen, setChosen] = useState<StarterLokPetId | null>(null);
  const [hits, setHits] = useState(0);
  const chosenVariant = chosen ? LOKPET_VARIANTS_BY_ID[chosen] : null;
  const phaseCopy = useMemo(() => {
    if (phase === 'fists') return `${starterCharacter.name} drew the short route. No deck. No weapon. Get through the block.`;
    if (phase === 'rustle') return 'Something digital is moving in the brush.';
    if (phase === 'choose') return inspected ? `${LOKPET_VARIANTS_BY_ID[inspected].name} steps out of the brush. This partner stays with you.` : 'Three companions answer from the brush. Meet one.';
    if (phase === 'partner') return `${chosenVariant?.name ?? 'Your partner'} is with ${starterCharacter.name}. Finish the fight.`;
    return `First night survived. ${starterCharacter.name} and your new partner are coming home.`;
  }, [chosenVariant?.name, inspected, phase, starterCharacter.name]);

  const punch = () => {
    const nextHits = hits + 1;
    setHits(nextHits);
    setEnemyHp(Math.max(42, enemyHp - 19));
    if (nextHits >= 3) setPhase('rustle');
  };

  const partnerStrike = () => {
    const next = Math.max(0, enemyHp - 24);
    setEnemyHp(next);
    if (next === 0 && chosen) {
      completeStarterLokPetOnboarding(chosen, starterCharacter.id);
      setPhase('victory');
    }
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-black text-white" data-testid="starter-lokpet-encounter">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_27%,rgba(34,211,238,.16),transparent_19%),radial-gradient(ellipse_at_83%_38%,rgba(249,115,22,.15),transparent_23%),linear-gradient(160deg,#080b18_0%,#11101a_45%,#050507_100%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] opacity-45 [background-image:linear-gradient(90deg,transparent_0,transparent_7%,rgba(34,211,238,.13)_7%,rgba(34,211,238,.13)_9%,transparent_9%,transparent_20%,rgba(249,115,22,.12)_20%,rgba(249,115,22,.12)_26%,transparent_26%,transparent_44%,rgba(34,211,238,.1)_44%,rgba(34,211,238,.1)_48%,transparent_48%),linear-gradient(0deg,rgba(0,0,0,.8),transparent)]" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(34,211,238,.1),transparent_34%),linear-gradient(to_bottom,rgba(0,0,0,.12),rgba(0,0,0,.9))]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,#fff_4px)]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-4 py-5 sm:px-8 sm:py-8">
        <header className="flex items-start justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.32em] text-orange-300">First arrival · en route to the hideout</p>
            <h1 className="mt-2 text-2xl font-black uppercase tracking-tight sm:text-4xl">The Block Has Teeth</h1>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-white/65">{phaseCopy}</p>
          </div>
          <p className="max-w-32 pt-1 text-right font-mono text-[10px] font-black uppercase tracking-[.16em] text-cyan-100/75">{starterCharacter.name}</p>
        </header>

        <section className="relative my-5 min-h-[320px] overflow-hidden border-y border-white/15 bg-black/30 p-4 shadow-[inset_0_0_60px_rgba(0,0,0,.65)] sm:min-h-[390px] sm:p-7">
          <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(transparent,rgba(249,115,22,.09))]" />
          <div className="absolute inset-x-8 bottom-16 h-px bg-gradient-to-r from-transparent via-orange-200/20 to-transparent" />

          <div className="relative grid min-h-[285px] grid-cols-[1fr_.72fr_1fr] items-end gap-2 sm:min-h-[335px] sm:gap-6">
            <div className="min-w-0 pb-2 text-center">
              <FighterModel character={starterCharacter} hits={hits} />
              <p className="mt-3 truncate text-sm font-black uppercase tracking-wide text-white">{starterCharacter.name}</p>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.18em] text-cyan-100/65">Fists up · moving to the beat</p>
            </div>

            <div className="relative flex min-h-40 items-end justify-center pb-8">
              <AnimatePresence mode="wait">
                {(phase === 'rustle' || phase === 'choose') && !chosenVariant ? (
                  <motion.button
                    key="rustle"
                    type="button"
                    initial={{ opacity: 0, scale: .75 }}
                    animate={{ opacity: 1, scale: [1, 1.05, 1], rotate: [-1, 1, -1] }}
                    exit={{ opacity: 0, scale: .75 }}
                    transition={{ scale: { repeat: Infinity, duration: 1.4 }, rotate: { repeat: Infinity, duration: .35 } }}
                    onClick={() => setPhase('choose')}
                    className="absolute bottom-10 left-1/2 w-24 -translate-x-1/2 border border-cyan-300/60 bg-cyan-950/80 px-2 py-4 text-center shadow-[0_0_32px_rgba(34,211,238,.32)]"
                    data-testid="button-investigate-bush"
                  >
                    <Sparkles className="mx-auto h-6 w-6 text-cyan-100" />
                    <span className="mt-2 block font-mono text-[9px] font-black uppercase tracking-[.18em] text-cyan-50">Digital rustle</span>
                  </motion.button>
                ) : chosenVariant ? (
                  <motion.div key="partner" initial={{ opacity: 0, y: 24, scale: .7 }} animate={{ opacity: 1, y: [0, -5, 0], scale: 1 }} transition={{ y: { repeat: Infinity, duration: 1.8 } }} className="text-center">
                    <div className="rounded-full bg-cyan-300/5 p-1 shadow-[0_0_35px_rgba(34,211,238,.22)]">
                      <LokPetIcon silhouette={chosenVariant.silhouette} palette={chosenVariant.palette} size={76} className="bg-black/55" />
                    </div>
                    <p className="mt-2 font-mono text-[9px] font-black uppercase tracking-wider text-cyan-100">Partner</p>
                  </motion.div>
                ) : (
                  <motion.div key="empty" className="mb-10 h-px w-12 bg-white/10" />
                )}
              </AnimatePresence>
            </div>

            <div className="min-w-0 pb-2 text-center">
              <EnemyModel enemy={enemy} hp={enemyHp} />
              <p className="mt-3 truncate text-sm font-black uppercase tracking-wide text-red-100">Block Scavenger</p>
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.18em] text-red-200/60">{enemy.name} · street threat</p>
              <div className="mx-auto mt-2 h-2 max-w-36 overflow-hidden border border-white/5 bg-white/10"><motion.div className="h-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,.55)]" animate={{ width: `${enemyHp}%` }} /></div>
            </div>
          </div>
        </section>

        {phase === 'fists' && (
          <button type="button" onClick={punch} className="mx-auto flex min-h-16 w-full max-w-md items-center justify-center gap-3 bg-orange-400 px-6 py-4 text-sm font-black uppercase tracking-[.18em] text-black shadow-[0_12px_45px_rgba(249,115,22,.16)] active:scale-[.98]" data-testid="button-starter-punch">
            <Swords className="h-5 w-5" /> {starterCharacter.name}: throw a punch
          </button>
        )}

        {phase === 'rustle' && <p className="text-center font-mono text-xs uppercase tracking-[.25em] text-cyan-100">Tap the movement in the brush</p>}

        {phase === 'choose' && (
          <div className="fixed inset-0 z-30 overflow-y-auto bg-black/94 p-4 backdrop-blur-md sm:p-8">
            <div className="mx-auto max-w-4xl pb-8">
              <p className="text-center font-mono text-[11px] font-black uppercase tracking-[.32em] text-cyan-100">Choose your first LokPet companion</p>
              <h2 className="mt-2 text-center text-3xl font-black uppercase">Three companions. One partner.</h2>
              <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/55">Each companion moves in the brush. Tap one to see their role, abilities, and growth path beside them.</p>

              <div className="mt-6 grid gap-3">
                {STARTER_LOKPET_IDS.map((id, index) => {
                  const variant = LOKPET_VARIANTS_BY_ID[id];
                  const open = inspected === id;
                  const details = STARTER_DETAILS[id];
                  return (
                    <motion.article key={id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 }} className={`relative overflow-hidden border transition ${open ? 'border-cyan-200/70 bg-cyan-950/35 shadow-[0_0_38px_rgba(34,211,238,.1)]' : 'border-white/15 bg-white/[.035]'}`}>
                      <button type="button" onClick={() => setInspected(id)} className="grid w-full grid-cols-[6.5rem_1fr] items-center gap-4 p-4 text-left sm:grid-cols-[8rem_1fr] sm:p-5" aria-pressed={open} data-testid={`button-starter-${id}`}>
                        <div className={`relative mx-auto w-fit transition duration-500 ${open ? '' : 'brightness-0 opacity-50'}`}>
                          <div className={`absolute inset-1 rounded-full blur-xl ${open ? 'bg-cyan-300/20' : 'bg-white/5'}`} />
                          <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} size={open ? 104 : 88} className="relative bg-black/50" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[.25em] text-white/45">LokPet companion · {open ? variant.family : 'waiting in the brush'}</p>
                          <h3 className="mt-1 text-xl font-black uppercase sm:text-2xl">{variant.name}</h3>
                          <p className="mt-2 text-sm font-bold uppercase tracking-wide text-cyan-100/75">{open ? details.role : 'Moving silhouette · tap to meet them'}</p>
                          {open ? <p className="mt-2 text-sm leading-relaxed text-white/60">{variant.description}</p> : null}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="grid gap-3 border-t border-cyan-100/15 p-4 sm:grid-cols-2 sm:p-5">
                              <div className="border border-pink-300/15 bg-black/35 p-3">
                                <p className="font-mono text-[10px] font-black uppercase tracking-widest text-pink-200"><Heart className="mr-2 inline h-4 w-4" />Active</p>
                                <p className="mt-2 text-sm leading-relaxed text-white/72">{details.active}</p>
                              </div>
                              <div className="border border-amber-300/15 bg-black/35 p-3">
                                <p className="font-mono text-[10px] font-black uppercase tracking-widest text-amber-200"><Zap className="mr-2 inline h-4 w-4" />Passive</p>
                                <p className="mt-2 text-sm leading-relaxed text-white/72">{details.passive}</p>
                              </div>
                              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/35 p-3">
                                <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-100"><Shield className="mr-2 inline h-4 w-4" />3 forms · level 99 max · {details.evolution}</p>
                                <button type="button" onClick={() => { setChosen(id); setPhase('partner'); }} className="min-h-12 bg-cyan-100 px-5 py-3 text-xs font-black uppercase tracking-[.18em] text-slate-950 active:scale-[.98]" data-testid="button-confirm-starter">Choose {variant.name}</button>
                              </div>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {phase === 'partner' && (
          <button type="button" onClick={partnerStrike} className="mx-auto flex min-h-16 w-full max-w-md items-center justify-center gap-3 bg-cyan-100 px-6 py-4 text-sm font-black uppercase tracking-[.16em] text-slate-950 shadow-[0_12px_45px_rgba(34,211,238,.14)] active:scale-[.98]" data-testid="button-partner-strike">
            <Zap className="h-5 w-5" /> Fight together
          </button>
        )}

        {phase === 'victory' && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="border border-emerald-300/40 bg-emerald-950/30 p-5 text-center shadow-[0_0_50px_rgba(16,185,129,.08)]" data-testid="starter-rewards">
            <p className="font-mono text-[10px] font-black uppercase tracking-[.28em] text-emerald-200">Partner bonded · rewards secured</p>
            <h2 className="mt-2 text-2xl font-black uppercase">{starterCharacter.name} + {chosenVariant?.name}</h2>
            <p className="mt-1 text-sm text-white/55">Your first field team is ready for the hideout.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold uppercase tracking-wide sm:flex sm:flex-wrap sm:justify-center">
              <span className="border border-white/15 px-3 py-2">First companion card</span>
              <span className="border border-white/15 px-3 py-2">2 free LokPacks</span>
              <span className="border border-white/15 px-3 py-2">40 Card Credits</span>
              <span className="border border-white/15 px-3 py-2">Hourly full refresh</span>
            </div>
            <button type="button" onClick={onEnterHideout} className="mt-5 inline-flex min-h-14 items-center gap-2 bg-orange-400 px-7 py-4 text-xs font-black uppercase tracking-[.2em] text-black active:scale-[.98]" data-testid="button-enter-hideout-after-starter"><PackageOpen className="h-5 w-5" /> Enter hideout & open packs</button>
          </motion.section>
        )}
      </div>
    </main>
  );
}

export default StarterLokPetEncounter;
