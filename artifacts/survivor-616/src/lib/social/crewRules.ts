import type { LokCrewState, LokFriend, LokPresence } from '@workspace/lok-client';

/** A crew holds up to four players, you included. */
export const MAX_CREW_SIZE = 4;

export function slotsLeft(crew: Pick<LokCrewState, 'members'>): number {
  return Math.max(0, MAX_CREW_SIZE - crew.members.length);
}

export function isLeader(state: LokCrewState, userId: string | null | undefined): boolean {
  return Boolean(userId && state.crew && state.crew.leaderId === userId);
}

/** Friends who can be invited right now: accepted, not already in the crew, and only while there is room. */
export function invitable(friends: readonly LokFriend[], state: LokCrewState): LokFriend[] {
  if (state.crew && slotsLeft(state) === 0) return [];
  const inCrew = new Set(state.members.map((m) => m.userId));
  return friends.filter((f) => f.status === 'accepted' && !inCrew.has(f.userId));
}

export type OnlineMap = Record<string, LokPresence>;

/** Online first (those who allow it), then by name. */
export function sortFriends<T extends { userId: string; name: string; showOnline: boolean }>(friends: readonly T[], online: OnlineMap): T[] {
  const isOn = (f: T) => f.showOnline && Boolean(online[f.userId]);
  return [...friends].sort((a, b) => Number(isOn(b)) - Number(isOn(a)) || a.name.localeCompare(b.name));
}

export const isOnline = (f: { userId: string; showOnline: boolean }, online: OnlineMap): boolean => f.showOnline && Boolean(online[f.userId]);

export function onlineCount(friends: readonly LokFriend[], online: OnlineMap): number {
  return friends.filter((f) => f.status === 'accepted' && isOnline(f, online)).length;
}

/** The other crew members, for the recent-players record. */
export function crewmateIds(state: LokCrewState, me: string | null | undefined): string[] {
  return state.members.map((m) => m.userId).filter((id) => id !== me);
}
