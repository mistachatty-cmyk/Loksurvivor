// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok hall presence: who else is standing in the hall right now, across every Lok game.
 *
 * One realtime channel (`lok-hall:v1`), no tables, nothing stored. Join/leave and the display tag ride on realtime
 * presence; positions ride on throttled broadcasts. Everything a peer sends is untrusted: `sanitizePeer` clamps the
 * position to the room, cuts the name to a short plain string and accepts only known games. Each game draws peers
 * its own way (a token and a name); there is no shared avatar. Cost: only while the hall is open, about 4 small
 * messages a second per person, none while the tab is hidden, and at most `MAX_PEERS` peers are tracked.
 */
import type { RoomGame, RoomLayout } from "./rooms";

export const HALL_CHANNEL = "lok-hall:v1";
export const MAX_PEERS = 24;
export const MOVE_INTERVAL_MS = 250;
const GAMES: readonly RoomGame[] = ["survivor", "qnk", "lok"];

export interface HallPeer { id: string; name: string; game: RoomGame; x: number; y: number }

/** The few parts of a Supabase realtime channel and client this module uses, so tests can fake them. */
export interface HallChannel {
  on(type: string, filter: Record<string, unknown>, cb: (msg: any) => void): HallChannel;
  subscribe(cb?: (status: string) => void): HallChannel;
  track(payload: Record<string, unknown>): Promise<unknown> | unknown;
  send(msg: { type: "broadcast"; event: string; payload: Record<string, unknown> }): Promise<unknown> | unknown;
  presenceState(): Record<string, Array<Record<string, unknown>>>;
  untrack?(): Promise<unknown> | unknown;
}
export interface HallClient { channel(name: string, opts?: Record<string, unknown>): HallChannel; removeChannel(ch: HallChannel): Promise<unknown> | unknown }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Turns whatever arrived into a safe peer, or null. Never trusts the sender's id over the channel key. */
export function sanitizePeer(raw: unknown, id: string, layout: RoomLayout): HallPeer | null {
  if (!raw || typeof raw !== "object" || !id) return null;
  const r = raw as Record<string, unknown>;
  const game = GAMES.find((g) => g === r.game);
  if (!game) return null;
  const name = typeof r.name === "string" ? r.name.replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16) : "";
  const x = typeof r.x === "number" && Number.isFinite(r.x) ? r.x : layout.start.col * layout.tile;
  const y = typeof r.y === "number" && Number.isFinite(r.y) ? r.y : layout.start.row * layout.tile;
  return { id: id.slice(0, 40), name: name || "Guest", game, x: clamp(x, 0, layout.cols * layout.tile), y: clamp(y, layout.tile * 2, layout.rows * layout.tile) };
}

/** A tag that is not a real name: used until the player picks a public handle. */
export const guestName = (id: string): string => `Guest ${id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}`;

export interface HallPresence {
  move(x: number, y: number, now?: number): void;
  peers(): HallPeer[];
  leave(): void;
}

export function joinHall(client: HallClient, opts: { id: string; name?: string; game: RoomGame; layout: RoomLayout; onPeers?: (peers: HallPeer[]) => void }): HallPresence {
  const { id, game, layout } = opts;
  const name = (opts.name && opts.name.trim()) || guestName(id);
  const pos = new Map<string, { x: number; y: number }>();
  const tags = new Map<string, HallPeer>();
  let last = 0, left = false;
  const ch = client.channel(HALL_CHANNEL, { config: { broadcast: { self: false }, presence: { key: id } } });
  const publish = () => opts.onPeers?.(list());
  const list = (): HallPeer[] => [...tags.values()].map((p) => ({ ...p, ...(pos.get(p.id) ?? {}) })).slice(0, MAX_PEERS);
  const readPresence = () => {
    tags.clear();
    for (const [key, metas] of Object.entries(ch.presenceState())) {
      if (key === id || tags.size >= MAX_PEERS) continue;
      const peer = sanitizePeer(metas[0], key, layout);
      if (peer) tags.set(key, peer);
    }
    for (const k of [...pos.keys()]) if (!tags.has(k)) pos.delete(k);
    publish();
  };
  ch.on("presence", { event: "sync" }, readPresence)
    .on("broadcast", { event: "pos" }, ({ payload }: { payload?: { id?: string; x?: number; y?: number } }) => {
      const key = payload?.id;
      if (!key || key === id || !tags.has(key)) return;
      const p = sanitizePeer({ game: tags.get(key)!.game, x: payload.x, y: payload.y }, key, layout);
      if (p) { pos.set(key, { x: p.x, y: p.y }); publish(); }
    })
    .subscribe((status) => { if (status === "SUBSCRIBED" && !left) void ch.track({ name, game, x: layout.start.col * layout.tile, y: layout.start.row * layout.tile }); });
  return {
    move(x, y, now = Date.now()) {
      if (left || now - last < MOVE_INTERVAL_MS) return;
      last = now;
      void ch.send({ type: "broadcast", event: "pos", payload: { id, x: Math.round(x), y: Math.round(y) } });
    },
    peers: list,
    leave() { if (left) return; left = true; void ch.untrack?.(); void client.removeChannel(ch); },
  };
}
