// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Lok Crew Follow: the host picks a game, everyone who follows is taken there, everyone says "in".
 *
 * A pure state machine. It never touches the network or the screen: the caller sends the messages it returns
 * over the crew channel and feeds incoming messages back in. That keeps every rule (who may launch, who is
 * pulled along, what happens when someone is on an old version) testable without a device.
 *
 * Flow: host `crewLaunch` -> message `crew.launch` -> each member `crewReceiveLaunch` decides go / chip / too old ->
 * members send `crew.ack` -> host `crewApplyAck` -> host sees "3 of 4 in" -> `crewTick` marks silent members timed out
 * -> `crewRetry` resends to one member. The crew is never stuck: every outcome has a plain state and a way on.
 */

import { compareSdk, type DirectoryRow } from "./gameDirectory";

export const CREW_PROTOCOL = 1;
export const ACK_TIMEOUT_MS = 8000;
export const MAX_ATTEMPTS = 3;

export type MemberStatus = "idle" | "in-game" | "offline";

export interface CrewMember {
  id: string;
  /** "Follow the host" switch. Default on. */
  follow: boolean;
  status: MemberStatus;
  /** The SDK version this member's app runs. */
  sdk: string;
}

/** How the launch treats a member: pulled along, offered a chip, or left alone. */
export type FollowPlan = "follow" | "chip" | "skip";
export type AckResult = "pending" | "in" | "declined" | "too-old" | "full" | "timeout" | "skipped";

export interface LaunchSlot {
  plan: FollowPlan;
  result: AckResult;
  attempts: number;
  sentAt: number;
}

export interface CrewLaunch {
  game: string;
  mode: string | null;
  room: string;
  nonce: string;
  sdk: string;
  minSdk: string;
  startedAt: number;
  slots: Record<string, LaunchSlot>;
}

export interface CrewState {
  crewId: string;
  hostId: string;
  /** Join order; the first remaining member inherits host when the host leaves. */
  order: string[];
  members: Record<string, CrewMember>;
  launch: CrewLaunch | null;
  /** Nonces this crew has already acted on, so a repeated message does nothing twice. */
  seen: string[];
}

export type CrewMessage =
  | { type: "crew.launch"; v: number; crew: string; game: string; mode: string | null; room: string; nonce: string; sdk: string; minSdk: string }
  | { type: "crew.ack"; v: number; crew: string; nonce: string; from: string; result: "in" | "declined" | "too-old" | "full" };

export type CrewError = "not-host" | "unknown-member" | "bad-row" | "offline-row" | "too-few" | "no-launch" | "stale-nonce" | "too-many-tries";

export type CrewStep<T = {}> = { state: CrewState; error?: CrewError } & T;

export function createFollowCrew(crewId: string, host: CrewMember): CrewState {
  return { crewId, hostId: host.id, order: [host.id], members: { [host.id]: { ...host } }, launch: null, seen: [] };
}

function fail(state: CrewState, error: CrewError): CrewStep {
  return { state, error };
}

export function crewAddMember(state: CrewState, member: CrewMember): CrewState {
  if (state.members[member.id]) return { ...state, members: { ...state.members, [member.id]: { ...state.members[member.id], ...member } } };
  return { ...state, order: [...state.order, member.id], members: { ...state.members, [member.id]: { ...member } } };
}

/** Removes a member. If the host leaves, the next member in join order becomes host. */
export function crewRemoveMember(state: CrewState, id: string): CrewState {
  if (!state.members[id]) return state;
  const members = { ...state.members };
  delete members[id];
  const order = state.order.filter((m) => m !== id);
  const hostId = state.hostId === id ? (order[0] ?? "") : state.hostId;
  let launch = state.launch;
  if (launch && launch.slots[id]) {
    const slots = { ...launch.slots };
    delete slots[id];
    launch = { ...launch, slots };
  }
  return { ...state, members, order, hostId, launch };
}

export function crewSetFollow(state: CrewState, id: string, follow: boolean): CrewStep {
  const m = state.members[id];
  if (!m) return fail(state, "unknown-member");
  return { state: { ...state, members: { ...state.members, [id]: { ...m, follow } } } };
}

export function crewSetStatus(state: CrewState, id: string, status: MemberStatus): CrewStep {
  const m = state.members[id];
  if (!m) return fail(state, "unknown-member");
  return { state: { ...state, members: { ...state.members, [id]: { ...m, status } } } };
}

/** The host hands the crew to someone else (or the crew creator reclaims it). Only the host may. */
export function crewSetHost(state: CrewState, byId: string, newHostId: string): CrewStep {
  if (byId !== state.hostId) return fail(state, "not-host");
  if (!state.members[newHostId]) return fail(state, "unknown-member");
  return { state: { ...state, hostId: newHostId } };
}

function planFor(m: CrewMember): FollowPlan {
  if (m.status === "offline") return "skip";
  if (!m.follow || m.status === "in-game") return "chip";
  return "follow";
}

/**
 * The host taps a game and mode. Returns the new state and the message to send to the whole crew.
 * Members are seated in order (host first); anyone past the row's player cap gets "full" with a plain line.
 * Members on an SDK older than the row needs get "too-old" up front.
 */
export function crewLaunch(state: CrewState, byId: string, row: DirectoryRow, room: string, nonce: string, now: number, sdk: string): CrewStep<{ message?: CrewMessage }> {
  if (byId !== state.hostId) return fail(state, "not-host");
  if (row.kind === "offline") return fail(state, "offline-row");
  if (!room || !nonce) return fail(state, "bad-row");
  const online = state.order.filter((id) => state.members[id].status !== "offline");
  if (online.length < row.minPlayers) return fail(state, "too-few");
  const slots: Record<string, LaunchSlot> = {};
  let seated = 0;
  for (const id of state.order) {
    const m = state.members[id];
    if (id === byId) {
      slots[id] = { plan: "follow", result: "in", attempts: 1, sentAt: now };
      seated += 1;
      continue;
    }
    let plan = planFor(m);
    let result: AckResult = plan === "skip" ? "skipped" : "pending";
    if (plan !== "skip" && compareSdk(m.sdk, row.minSdk) < 0) result = "too-old";
    else if (plan !== "skip" && seated >= row.maxPlayers) result = "full";
    else if (plan !== "skip") seated += plan === "follow" ? 1 : 0;
    slots[id] = { plan, result, attempts: plan === "skip" ? 0 : 1, sentAt: now };
  }
  const next: CrewLaunch = { game: row.app, mode: row.id.split(".").slice(1).join(".") || null, room, nonce, sdk, minSdk: row.minSdk, startedAt: now, slots };
  const message: CrewMessage = { type: "crew.launch", v: CREW_PROTOCOL, crew: state.crewId, game: next.game, mode: next.mode, room, nonce, sdk, minSdk: row.minSdk };
  return { state: { ...state, launch: next, seen: [...state.seen, nonce].slice(-20) }, message };
}

export type LaunchDecision =
  | { action: "go"; ack: Extract<CrewMessage, { type: "crew.ack" }> }
  | { action: "chip"; ack: null }
  | { action: "too-old"; ack: Extract<CrewMessage, { type: "crew.ack" }> }
  | { action: "ignore"; ack: null };

/**
 * A member's own device decides what a launch means for it. `seenNonces` is the device's memory of nonces it
 * already handled. A follower goes and acknowledges; someone with Follow off or mid-match gets a chip and says
 * nothing until they tap it; an old app says so; a repeat or another crew's message is ignored.
 */
export function crewReceiveLaunch(me: CrewMember, crewId: string, msg: CrewMessage, seenNonces: string[]): LaunchDecision {
  if (msg.type !== "crew.launch" || msg.crew !== crewId || msg.v !== CREW_PROTOCOL || seenNonces.includes(msg.nonce)) return { action: "ignore", ack: null };
  const ack = (result: "in" | "too-old"): Extract<CrewMessage, { type: "crew.ack" }> => ({ type: "crew.ack", v: CREW_PROTOCOL, crew: crewId, nonce: msg.nonce, from: me.id, result });
  if (compareSdk(me.sdk, msg.minSdk) < 0) return { action: "too-old", ack: ack("too-old") };
  if (planFor(me) !== "follow") return { action: "chip", ack: null };
  return { action: "go", ack: ack("in") };
}

/** The member taps the chip later: same as going, so it acknowledges the launch they were offered. */
export function crewAcceptChip(me: CrewMember, crewId: string, msg: CrewMessage): Extract<CrewMessage, { type: "crew.ack" }> | null {
  if (msg.type !== "crew.launch" || msg.crew !== crewId || compareSdk(me.sdk, msg.minSdk) < 0) return null;
  return { type: "crew.ack", v: CREW_PROTOCOL, crew: crewId, nonce: msg.nonce, from: me.id, result: "in" };
}

/** The host records an acknowledgement. A wrong or old nonce changes nothing. */
export function crewApplyAck(state: CrewState, msg: CrewMessage): CrewStep {
  if (msg.type !== "crew.ack" || msg.crew !== state.crewId) return fail(state, "stale-nonce");
  const l = state.launch;
  if (!l) return fail(state, "no-launch");
  if (msg.nonce !== l.nonce) return fail(state, "stale-nonce");
  const slot = l.slots[msg.from];
  if (!slot) return fail(state, "unknown-member");
  if (slot.result === "full" || slot.result === "skipped") return { state };
  const slots = { ...l.slots, [msg.from]: { ...slot, result: msg.result as AckResult } };
  return { state: { ...state, launch: { ...l, slots } } };
}

/** Marks everyone who never answered as timed out so the host sees a plain state, not a spinner. */
export function crewTick(state: CrewState, now: number): CrewState {
  const l = state.launch;
  if (!l) return state;
  let changed = false;
  const slots: Record<string, LaunchSlot> = {};
  for (const [id, s] of Object.entries(l.slots)) {
    if (s.result === "pending" && s.plan === "follow" && now - s.sentAt >= ACK_TIMEOUT_MS) {
      slots[id] = { ...s, result: "timeout" };
      changed = true;
    } else slots[id] = s;
  }
  return changed ? { ...state, launch: { ...l, slots } } : state;
}

/** The host resends the launch to one member who timed out, declined or is a chip. Up to MAX_ATTEMPTS. */
export function crewRetry(state: CrewState, byId: string, memberId: string, now: number): CrewStep<{ message?: CrewMessage }> {
  if (byId !== state.hostId) return fail(state, "not-host");
  const l = state.launch;
  if (!l) return fail(state, "no-launch");
  const slot = l.slots[memberId];
  if (!slot) return fail(state, "unknown-member");
  if (slot.attempts >= MAX_ATTEMPTS) return fail(state, "too-many-tries");
  const slots = { ...l.slots, [memberId]: { ...slot, result: "pending" as AckResult, plan: "follow" as FollowPlan, attempts: slot.attempts + 1, sentAt: now } };
  const message: CrewMessage = { type: "crew.launch", v: CREW_PROTOCOL, crew: state.crewId, game: l.game, mode: l.mode, room: l.room, nonce: l.nonce, sdk: l.sdk, minSdk: l.minSdk };
  return { state: { ...state, launch: { ...l, slots } }, message };
}

export interface LaunchSummary {
  /** Members confirmed in, host included. */
  inCount: number;
  /** Members the launch counts toward (everyone not skipped or full). */
  total: number;
  pending: string[];
  needsHelp: { id: string; result: AckResult }[];
  /** True when everyone expected is in; the host may start. The host can start sooner at their own choice. */
  ready: boolean;
  /** Plain text for the host strip: "3 of 4 in". */
  line: string;
}

export function crewSummary(state: CrewState): LaunchSummary | null {
  const l = state.launch;
  if (!l) return null;
  const entries = Object.entries(l.slots).filter(([, s]) => s.result !== "skipped" && s.result !== "full");
  const pending = entries.filter(([, s]) => s.result === "pending").map(([id]) => id);
  const needsHelp = entries.filter(([, s]) => s.result === "timeout" || s.result === "declined" || s.result === "too-old" || (s.plan === "chip" && s.result === "pending")).map(([id, s]) => ({ id, result: s.result }));
  const inCount = entries.filter(([, s]) => s.result === "in").length;
  const total = entries.length;
  // A chip member is offered the game but not waited on; ready means every follower answered "in".
  const followers = entries.filter(([, s]) => s.plan === "follow");
  const ready = followers.length > 0 && followers.every(([, s]) => s.result === "in");
  return { inCount, total, pending, needsHelp, ready, line: `${inCount} of ${total} in` };
}
