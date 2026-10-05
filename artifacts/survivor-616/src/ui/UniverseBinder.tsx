/**
 * The Universe Binder: every card from every LOK game in one place, split by
 * game or shown together, with decks that follow the account.
 *
 * Every card is redrawn from its published art recipe (RegistryCardArt): this
 * game's cards from their real rigs, other games' cards from that game's own
 * sprite data. Recipes are procedural JSON, never bitmaps -- see
 * .agents/memory/survivor-616-art-assets.md.
 */
import { useMemo, useState } from 'react';
import { Layers, Lock, Plus, Radio, Trash2 } from 'lucide-react';

import { isCardOwned } from '@/game/data/cards';
import type { MetaState } from '@/game/types';
import type { LokAssetManifest } from '@/game/lok/types';
import { RARITY_ORDER, MAX_DECK_SIZE, type RegistryCard } from '@workspace/lok-client';
import { OWN_GAME_KEY, gameLabel, useUniverseCards, useUniverseDecks } from '@/state/universeCardsStore';
import { RARITY_STYLE } from './LockDeckCollection';
import { RegistryCardArt } from './RegistryCardArt';

const STATUS_COPY = {
  local: 'Showing this game only -- the shared registry is not configured here.',
  loading: 'Syncing the universe…',
  live: 'Live: cards from every LOK game stream in as they are published.',
  offline: 'Offline -- showing the last synced cards.',
} as const;

function isOwned(card: RegistryCard, meta: MetaState, collectedIds: ReadonlySet<string>, visitingIds: ReadonlySet<string>) {
  if (collectedIds.has(card.assetId) || visitingIds.has(card.assetId)) return true;
  return card.sourceGame === OWN_GAME_KEY && isCardOwned(card.manifest as unknown as LokAssetManifest, meta);
}

function CardFace({ card, owned, onClick, inDeck }: { card: RegistryCard; owned: boolean; onClick: () => void; inDeck: boolean }) {
  const style = RARITY_STYLE[card.rarity] ?? RARITY_STYLE.common!;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center border p-2 text-left transition-colors hover:bg-white/5 ${inDeck ? 'bg-white/10' : 'bg-card'}`}
      style={{ borderColor: owned ? style.edge : 'rgba(255,255,255,.08)', boxShadow: owned ? `0 0 14px ${style.glow}` : undefined }}
      data-testid={`binder-card-${card.assetId}`}
      aria-pressed={inDeck}
    >
      <div
        className="flex h-24 w-full items-center justify-center overflow-hidden"
        style={owned ? undefined : { filter: `brightness(0) drop-shadow(0 0 3px ${style.edge}) opacity(.75)` }}
      >
        <RegistryCardArt card={card} size={96} animated={false} />
      </div>
      <p className={`mt-2 w-full truncate text-[11px] font-black uppercase tracking-wide ${owned ? 'text-white' : 'text-muted-foreground'}`}>{owned ? card.name : '???'}</p>
      <p className="w-full truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {gameLabel(card.sourceGame)} · {card.rarity}
      </p>
      {!owned && <Lock className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />}
      {inDeck && <span className="absolute right-2 top-2 font-mono text-[9px] font-bold text-emerald-300">IN DECK</span>}
    </button>
  );
}

export function UniverseBinder({ meta }: { meta: MetaState }) {
  const { cards, status, collectedIds, games } = useUniverseCards();
  const { decks, synced, save, remove } = useUniverseDecks();
  const [game, setGame] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | string>('all');
  const [setId, setSetId] = useState<'all' | string>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const visitingIds = useMemo(() => new Set(meta.visitingLokCards.map((card) => card.assetId)), [meta.visitingLokCards]);
  const deck = decks.find((entry) => entry.id === deckId) ?? null;
  const inDeck = useMemo(() => new Set(deck?.assetIds ?? []), [deck]);

  const countsByGame = useMemo(() => {
    const counts: Record<string, { total: number; owned: number }> = { all: { total: 0, owned: 0 } };
    for (const card of cards) {
      const owned = isOwned(card, meta, collectedIds, visitingIds);
      for (const key of ['all', card.sourceGame]) {
        const entry = (counts[key] ??= { total: 0, owned: 0 });
        entry.total += 1;
        if (owned) entry.owned += 1;
      }
    }
    return counts;
  }, [cards, meta, collectedIds, visitingIds]);

  const inGame = useMemo(() => cards.filter((card) => game === 'all' || card.sourceGame === game), [cards, game]);
  const setOptions = useMemo(() => [...new Set(inGame.map((card) => card.setId))].sort(), [inGame]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inGame
      .filter((card) => rarity === 'all' || card.rarity === rarity)
      .filter((card) => setId === 'all' || card.setId === setId)
      .filter((card) => !needle || card.name.toLowerCase().includes(needle) || card.tags.some((tag) => tag.toLowerCase().includes(needle)))
      .filter((card) => !ownedOnly || isOwned(card, meta, collectedIds, visitingIds))
      .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name));
  }, [inGame, query, rarity, setId, ownedOnly, meta, collectedIds, visitingIds]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.assetId, card])), [cards]);
  const deckCards = (deck?.assetIds ?? []).map((id) => cardsById.get(id)).filter((card): card is RegistryCard => !!card);
  const deckPower = deckCards.reduce((sum, card) => sum + (card.combat ? card.combat.hp / 10 + card.combat.attack : 0), 0);

  const createDeck = async () => {
    const name = draftName.trim() || `Deck ${decks.length + 1}`;
    const id = await save({ name, gameScope: game, assetIds: [] });
    if (id) setDeckId(id);
    setDraftName('');
  };

  const toggleInDeck = (card: RegistryCard) => {
    if (!deck || !isOwned(card, meta, collectedIds, visitingIds)) return;
    const next = inDeck.has(card.assetId) ? deck.assetIds.filter((id) => id !== card.assetId) : [...deck.assetIds, card.assetId];
    if (next.length > MAX_DECK_SIZE) return;
    void save({ id: deck.id, name: deck.name, gameScope: deck.gameScope, assetIds: next });
  };

  return (
    <section className="mt-8 border-t border-border pt-6" data-testid="section-universe-binder">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Layers className="h-5 w-5 text-sky-300" />
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-white">Universe Binder</h3>
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground" data-testid="text-binder-status">
            <Radio className="h-3 w-3" /> {STATUS_COPY[status]}
          </p>
        </div>
        <span className="ml-auto font-mono text-sm font-bold text-muted-foreground">
          {countsByGame.all?.owned ?? 0} / {countsByGame.all?.total ?? 0} collected
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Binder by game">
        {['all', ...games].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={game === key}
            onClick={() => { setGame(key); setSetId('all'); }}
            className={`border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${game === key ? 'border-sky-300 bg-sky-300/10 text-sky-200' : 'border-border text-muted-foreground hover:text-white'}`}
            data-testid={`binder-tab-${key}`}
          >
            {key === 'all' ? 'All games' : gameLabel(key)} · {countsByGame[key]?.owned ?? 0}/{countsByGame[key]?.total ?? 0}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or tag…" className="w-48 border border-border bg-black/30 px-2 py-1.5 text-white" />
        <select value={rarity} onChange={(event) => setRarity(event.target.value)} className="border border-border bg-black/30 px-2 py-1.5 text-white">
          <option value="all">Any rarity</option>
          {RARITY_ORDER.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={setId} onChange={(event) => setSetId(event.target.value)} className="border border-border bg-black/30 px-2 py-1.5 text-white">
          <option value="all">Any set</option>
          {setOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <label className="flex items-center gap-1 text-muted-foreground">
          <input type="checkbox" checked={ownedOnly} onChange={(event) => setOwnedOnly(event.target.checked)} /> Collected only
        </label>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{visible.length} shown</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="grid max-h-[34rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4" data-testid="binder-grid">
          {visible.slice(0, 240).map((card) => (
            <CardFace
              key={card.assetId}
              card={card}
              owned={isOwned(card, meta, collectedIds, visitingIds)}
              inDeck={inDeck.has(card.assetId)}
              onClick={() => toggleInDeck(card)}
            />
          ))}
          {visible.length === 0 && <p className="col-span-full text-xs italic text-muted-foreground">No cards match.</p>}
        </div>

        <aside className="border border-border bg-card p-3" data-testid="binder-decks">
          <p className="text-[10px] font-black uppercase tracking-widest text-white">Decks</p>
          <p className="mb-2 text-[10px] text-muted-foreground">{synced ? 'Saved to your account -- every LOK game sees them.' : 'Saved on this device. Sign in to carry them across games.'}</p>
          <div className="flex gap-1">
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="New deck name" className="min-w-0 flex-1 border border-border bg-black/30 px-2 py-1 text-xs text-white" maxLength={60} />
            <button type="button" onClick={() => void createDeck()} className="border border-sky-300/40 px-2 text-sky-200 hover:bg-sky-300/10" aria-label="Create deck" data-testid="button-create-deck"><Plus className="h-4 w-4" /></button>
          </div>
          <ul className="mt-2 space-y-1">
            {decks.map((entry) => (
              <li key={entry.id} className={`flex items-center gap-1 border px-2 py-1 text-xs ${entry.id === deckId ? 'border-sky-300 text-white' : 'border-border text-muted-foreground'}`}>
                <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setDeckId(entry.id)}>
                  {entry.name} <span className="font-mono text-[9px]">· {entry.assetIds.length}/{MAX_DECK_SIZE} · {entry.gameScope === 'all' ? 'all games' : gameLabel(entry.gameScope)}</span>
                </button>
                <button type="button" onClick={() => { void remove(entry.id); if (deckId === entry.id) setDeckId(null); }} aria-label={`Delete ${entry.name}`}><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
            {decks.length === 0 && <li className="text-[11px] italic text-muted-foreground">No decks yet.</li>}
          </ul>
          {deck && (
            <div className="mt-3 border-t border-border pt-2" data-testid="deck-detail">
              <p className="text-[11px] font-bold text-white">{deck.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{deckCards.length} cards · power {Math.round(deckPower)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Click collected cards to add or remove them.</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-[11px] text-white/80">
                {deckCards.map((card) => <li key={card.assetId} className="truncate">{card.name} <span className="text-muted-foreground">· {gameLabel(card.sourceGame)}</span></li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
