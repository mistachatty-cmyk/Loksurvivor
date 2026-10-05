/**
 * Live view of the LOK Card Universe for this game: the shared `lok_cards`
 * registry (every game's cards, streamed in) merged over this game's own
 * local cards, plus decks that follow the account. See
 * Lok-EcoSystsem/LokToken EcoSystem/LOK_CARD_UNIVERSE.md.
 *
 * Everything degrades to local-only: no network, no sign-in, or an
 * unconfigured client just means the binder shows this game's own cards and
 * decks live in localStorage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteDeck,
  fetchCollection,
  fetchRegistryCards,
  listDecks,
  saveDeck,
  subscribeRegistry,
  combatForRarity,
  type RegistryCard,
  type RegistryDeck,
  type RegistryRarity,
} from '@workspace/lok-client';

import { CARD_MANIFESTS } from '@/game/data/cards';
import { artRecipeFor } from '@/game/data/cardArt';
import type { LokDeckCardMetadata } from '@/game/data/cards';
import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';

export const OWN_GAME_KEY = 'survivor616';

/** Display names for known lok_apps keys; unknown games fall back to their key. */
export const GAME_LABELS: Record<string, string> = {
  survivor616: '616 Survivor',
  spendutall: 'Spend It All',
  gsix: 'GSix',
  loklingu: 'LokLingu',
  lokbook: 'LokBook',
};
export const gameLabel = (key: string) => GAME_LABELS[key] ?? key;

const CACHE_KEY = 'survivor616.universeRegistry.v1';
const DECKS_KEY = 'survivor616.universeDecks.v1';

/** This game's own cards, projected the same way the publisher publishes them. */
export const LOCAL_REGISTRY_CARDS: RegistryCard[] = CARD_MANIFESTS.map((card) => {
  const meta = (card.metadata ?? {}) as Partial<LokDeckCardMetadata>;
  const role = meta.subjectType === 'enemy' ? 'enemy' : meta.subjectType === 'lokpet' ? 'companion' : 'hero';
  return {
    assetId: card.id,
    sourceGame: OWN_GAME_KEY,
    namespace: card.namespace,
    setId: meta.setId ?? 'misc',
    setName: null,
    cardNumber: meta.cardNumber ?? null,
    kind: card.kind,
    name: card.name,
    description: card.description ?? null,
    rarity: card.rarity as RegistryRarity,
    tags: card.tags ?? [],
    combat: combatForRarity(card.rarity, role),
    art: artRecipeFor(card),
    manifest: card as unknown as Record<string, unknown>,
    updatedAt: '',
  };
});

function readCache(): RegistryCard[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RegistryCard[]) : [];
  } catch {
    return [];
  }
}

function writeCache(cards: RegistryCard[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cards));
  } catch {
    // Quota or blocked storage: the cache is only a head start, never required.
  }
}

export type RegistryStatus = 'local' | 'loading' | 'live' | 'offline';

export interface UniverseCards {
  /** Every known card, de-duplicated by assetId. Registry rows win over local ones. */
  cards: RegistryCard[];
  status: RegistryStatus;
  /** assetIds the signed-in account has collected server-side. */
  collectedIds: ReadonlySet<string>;
  games: string[];
}

export function useUniverseCards(): UniverseCards {
  const { session } = useAuth();
  const [remote, setRemote] = useState<RegistryCard[]>(() => readCache());
  const [status, setStatus] = useState<RegistryStatus>(lokClient ? 'loading' : 'local');
  const [collectedIds, setCollectedIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!lokClient) return;
    let cancelled = false;
    void fetchRegistryCards(lokClient).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRemote(result.cards);
        writeCache(result.cards);
        setStatus('live');
      } else {
        setStatus('offline');
      }
    });
    // New or edited cards from any game land here without a reload.
    const unsubscribe = subscribeRegistry(lokClient, (card) => {
      setRemote((current) => [...current.filter((entry) => entry.assetId !== card.assetId), card]);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!lokClient || !session) {
      setCollectedIds(new Set());
      return;
    }
    void fetchCollection(lokClient).then((result) => {
      if (result.ok) setCollectedIds(new Set(result.entries.map((entry) => entry.assetId)));
    });
  }, [session]);

  const cards = useMemo(() => {
    const byId = new Map<string, RegistryCard>();
    for (const card of LOCAL_REGISTRY_CARDS) byId.set(card.assetId, card);
    for (const card of remote) byId.set(card.assetId, card);
    return [...byId.values()];
  }, [remote]);

  const games = useMemo(() => {
    const keys = new Set(cards.map((card) => card.sourceGame));
    return [OWN_GAME_KEY, ...[...keys].filter((key) => key !== OWN_GAME_KEY).sort()];
  }, [cards]);

  return { cards, status, collectedIds, games };
}

function readLocalDecks(): RegistryDeck[] {
  try {
    const raw = localStorage.getItem(DECKS_KEY);
    return raw ? (JSON.parse(raw) as RegistryDeck[]) : [];
  } catch {
    return [];
  }
}

export interface DeckApi {
  decks: RegistryDeck[];
  /** True when decks are stored on the account (follow you to every LOK game). */
  synced: boolean;
  save: (deck: { id?: string; name: string; gameScope: string; assetIds: string[] }) => Promise<string | null>;
  remove: (id: string) => Promise<void>;
}

export function useUniverseDecks(): DeckApi {
  const { session } = useAuth();
  const synced = !!(lokClient && session);
  const [decks, setDecks] = useState<RegistryDeck[]>(() => readLocalDecks());
  const accountId = session?.user.id;
  const decksRef = useRef(decks);
  decksRef.current = decks;

  useEffect(() => {
    if (!lokClient || !session) {
      setDecks(readLocalDecks());
      return;
    }
    void listDecks(lokClient).then((result) => {
      if (result.ok) setDecks(result.decks);
    });
  }, [session]);

  const persistLocal = (next: RegistryDeck[]) => {
    setDecks(next);
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(next));
    } catch {
      // Unsaved decks still work for this session.
    }
  };

  const save = useCallback<DeckApi['save']>(
    async (deck) => {
      if (lokClient && accountId) {
        const result = await saveDeck(lokClient, accountId, deck);
        if (!result.ok) return null;
        const refreshed = await listDecks(lokClient);
        if (refreshed.ok) setDecks(refreshed.decks);
        return result.id ?? null;
      }
      const id = deck.id ?? crypto.randomUUID();
      const entry: RegistryDeck = { id, name: deck.name.slice(0, 60), gameScope: deck.gameScope, assetIds: deck.assetIds.slice(0, 40), updatedAt: new Date().toISOString() };
      persistLocal([entry, ...decksRef.current.filter((existing) => existing.id !== id)]);
      return id;
    },
    [accountId],
  );

  const remove = useCallback<DeckApi['remove']>(
    async (id) => {
      if (lokClient && accountId) {
        await deleteDeck(lokClient, id);
        setDecks((current) => current.filter((deck) => deck.id !== id));
        return;
      }
      persistLocal(decksRef.current.filter((deck) => deck.id !== id));
    },
    [accountId],
  );

  return { decks, synced, save, remove };
}
