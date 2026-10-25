import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

/**
 * Friends, crews and recent players, shared by every Lok game. Everything goes through the
 * `lok_*` functions in supabase/migrations/20261025_lok_friends_crew.sql, which check who is
 * asking. Who is online is not stored: it rides Realtime presence (see `joinPresence`).
 */

export interface LokPlayerCard {
  userId: string;
  friendCode: string;
  displayName: string;
  avatarUrl: string | null;
  showOnline: boolean;
  allowRequests: boolean;
}

export interface LokFriend {
  userId: string;
  name: string;
  avatar: string | null;
  showOnline: boolean;
  /** `pending` rows are requests; `incoming` says who has to answer. */
  status: "pending" | "accepted";
  incoming: boolean;
}

export interface LokRecentPlayer {
  userId: string;
  name: string;
  avatar: string | null;
  game: string;
  lastPlayedAt: string;
  isFriend: boolean;
}

export interface LokCrewMember {
  userId: string;
  name: string;
  avatar: string | null;
  showOnline: boolean;
}

export interface LokCrewInvite {
  crewId: string;
  fromId: string;
  fromName: string;
  fromAvatar: string | null;
}

export interface LokCrewState {
  crew: { id: string; leaderId: string; game: string } | null;
  members: LokCrewMember[];
  invites: LokCrewInvite[];
}

export type FriendRequestResult = "sent" | "accepted" | "already" | "self" | "unknown" | "closed" | "limit";
export type CrewInviteResult = "sent" | "already" | "full" | "not-friend" | "not-member";
export type CrewAcceptResult = "joined" | "full" | "no-invite";

export const EMPTY_CREW_STATE: LokCrewState = { crew: null, members: [], invites: [] };

interface CardRow { user_id: string; friend_code: string; display_name: string; avatar_url: string | null; show_online: boolean; allow_requests: boolean }

const toCard = (r: CardRow): LokPlayerCard => ({
  userId: r.user_id, friendCode: r.friend_code, displayName: r.display_name, avatarUrl: r.avatar_url, showOnline: r.show_online, allowRequests: r.allow_requests,
});

type Failure = { ok: false; error: string };
const fail = (message: string): Failure => ({ ok: false, error: message });

/** Creates the player's card on first use and refreshes the name and picture from their sign-in. */
export async function syncPlayerCard(client: SupabaseClient, name: string, avatar: string | null): Promise<{ ok: true; card: LokPlayerCard } | Failure> {
  const { data, error } = await client.rpc("lok_card_sync", { p_name: name, p_avatar: avatar });
  if (error || !data) return fail(error?.message ?? "No card returned");
  return { ok: true, card: toCard(data as CardRow) };
}

export async function setCardSettings(client: SupabaseClient, settings: { showOnline?: boolean; allowRequests?: boolean }): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_card_settings", { p_show_online: settings.showOnline ?? null, p_allow_requests: settings.allowRequests ?? null });
  return { error: error?.message ?? null };
}

export async function newFriendCode(client: SupabaseClient): Promise<{ ok: true; code: string } | Failure> {
  const { data, error } = await client.rpc("lok_card_new_code");
  return error || typeof data !== "string" ? fail(error?.message ?? "No code returned") : { ok: true, code: data };
}

export async function requestFriend(client: SupabaseClient, code: string): Promise<{ ok: true; result: FriendRequestResult } | Failure> {
  const { data, error } = await client.rpc("lok_friend_request", { p_code: code });
  return error || typeof data !== "string" ? fail(error?.message ?? "No answer") : { ok: true, result: data as FriendRequestResult };
}

export async function respondToFriend(client: SupabaseClient, otherId: string, accept: boolean): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_friend_respond", { p_other: otherId, p_accept: accept });
  return { error: error?.message ?? null };
}

export async function removeFriend(client: SupabaseClient, otherId: string): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_friend_remove", { p_other: otherId });
  return { error: error?.message ?? null };
}

export async function listFriends(client: SupabaseClient): Promise<{ ok: true; friends: LokFriend[] } | Failure> {
  const { data, error } = await client.rpc("lok_friends_list");
  if (error) return fail(error.message);
  const rows = (data ?? []) as Array<{ user_id: string; display_name: string; avatar_url: string | null; show_online: boolean; status: "pending" | "accepted"; incoming: boolean }>;
  return { ok: true, friends: rows.map((r) => ({ userId: r.user_id, name: r.display_name, avatar: r.avatar_url, showOnline: r.show_online, status: r.status, incoming: r.incoming })) };
}

export async function recordRecentPlayers(client: SupabaseClient, otherIds: string[], game: string): Promise<{ error: string | null }> {
  if (otherIds.length === 0) return { error: null };
  const { error } = await client.rpc("lok_record_recent", { p_others: otherIds.slice(0, 8), p_game: game });
  return { error: error?.message ?? null };
}

export async function listRecentPlayers(client: SupabaseClient): Promise<{ ok: true; players: LokRecentPlayer[] } | Failure> {
  const { data, error } = await client.rpc("lok_recent_list");
  if (error) return fail(error.message);
  const rows = (data ?? []) as Array<{ user_id: string; display_name: string; avatar_url: string | null; game: string; last_played_at: string; is_friend: boolean }>;
  return { ok: true, players: rows.map((r) => ({ userId: r.user_id, name: r.display_name, avatar: r.avatar_url, game: r.game, lastPlayedAt: r.last_played_at, isFriend: r.is_friend })) };
}

export async function getCrewState(client: SupabaseClient): Promise<{ ok: true; state: LokCrewState } | Failure> {
  const { data, error } = await client.rpc("lok_crew_state");
  if (error || !data) return fail(error?.message ?? "No crew state");
  const s = data as LokCrewState;
  return { ok: true, state: { crew: s.crew ?? null, members: s.members ?? [], invites: s.invites ?? [] } };
}

export async function createCrew(client: SupabaseClient, game: string): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_crew_create", { p_game: game });
  return { error: error?.message ?? null };
}

export async function inviteToCrew(client: SupabaseClient, crewId: string, userId: string): Promise<{ ok: true; result: CrewInviteResult } | Failure> {
  const { data, error } = await client.rpc("lok_crew_invite", { p_crew: crewId, p_to: userId });
  return error || typeof data !== "string" ? fail(error?.message ?? "No answer") : { ok: true, result: data as CrewInviteResult };
}

export async function acceptCrewInvite(client: SupabaseClient, crewId: string): Promise<{ ok: true; result: CrewAcceptResult } | Failure> {
  const { data, error } = await client.rpc("lok_crew_accept", { p_crew: crewId });
  return error || typeof data !== "string" ? fail(error?.message ?? "No answer") : { ok: true, result: data as CrewAcceptResult };
}

export async function declineCrewInvite(client: SupabaseClient, crewId: string): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_crew_decline", { p_crew: crewId });
  return { error: error?.message ?? null };
}

export async function leaveCrew(client: SupabaseClient): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_crew_leave");
  return { error: error?.message ?? null };
}

export async function kickFromCrew(client: SupabaseClient, userId: string): Promise<{ error: string | null }> {
  const { error } = await client.rpc("lok_crew_kick", { p_user: userId });
  return { error: error?.message ?? null };
}

/** Runs `onChange` whenever a friend request, crew roster or crew invite row changes. Returns an unsubscribe. */
export function subscribeSocial(client: SupabaseClient, userId: string, onChange: () => void): () => void {
  const channel: RealtimeChannel = client
    .channel(`lok-social-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "lok_friendships" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "lok_crew_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "lok_crew_invites" }, onChange)
    .subscribe();
  return () => void client.removeChannel(channel);
}

/** What a player says about themselves while connected. Never saved. */
export interface LokPresence {
  game: string;
  /** `menu`, `run` or `theater`: shown next to the name. */
  doing: string;
  /** Set while the player hosts an open crew run: the room a crewmate can drop into. */
  room?: string;
}

/**
 * Joins the shared presence room. `track` announces this player; `onSync` receives every player
 * currently connected, keyed by account id. Present only while the tab is open.
 */
export function joinPresence(
  client: SupabaseClient,
  userId: string,
  onSync: (online: Record<string, LokPresence>) => void,
): { track: (state: LokPresence) => void; untrack: () => void; leave: () => void } {
  const channel = client.channel("lok-presence", { config: { presence: { key: userId } } });
  channel.on("presence", { event: "sync" }, () => {
    const raw = channel.presenceState() as Record<string, Array<Partial<LokPresence>>>;
    const out: Record<string, LokPresence> = {};
    for (const [key, metas] of Object.entries(raw)) {
      const latest = metas[metas.length - 1];
      if (latest) {
        out[key] = { game: String(latest.game ?? ""), doing: String(latest.doing ?? "menu") };
        if (typeof latest.room === "string" && latest.room) out[key]!.room = latest.room.slice(0, 80);
      }
    }
    onSync(out);
  });
  channel.subscribe();
  return {
    track: (state) => void channel.track(state),
    untrack: () => void channel.untrack(),
    leave: () => void client.removeChannel(channel),
  };
}

/** A private channel shared by one crew, for short live messages such as listening together. */
export function openCrewChannel(
  client: SupabaseClient,
  crewId: string,
  onMessage: (event: string, payload: Record<string, unknown>) => void,
): { send: (event: string, payload: Record<string, unknown>) => void; leave: () => void } {
  const channel = client.channel(`lok-crew-${crewId}`, { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "*" }, (message) => onMessage(String(message.event), (message.payload ?? {}) as Record<string, unknown>));
  channel.subscribe();
  return {
    send: (event, payload) => void channel.send({ type: "broadcast", event, payload }),
    leave: () => void client.removeChannel(channel),
  };
}
