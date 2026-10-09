/**
 * Crew call-ins: a rescued ally lends a hand once in a while during a run. One shared
 * cooldown; each press calls the next rescued ally in the order they joined, so a
 * bigger crew means more variety, not a longer list to manage. No slot is spent.
 *
 * Every effect reuses something the engine already has (healing, the i-frame window,
 * `damageEnemy`, the freeze timer, the magnet coil, faster weapons), so a new call-in
 * is a record here and never an edit to the simulation loop. Lines stay kid-safe.
 */

export type CallInEffect =
  | { kind: 'heal'; pct: number }
  | { kind: 'shield'; ms: number }
  | { kind: 'nova'; damage: number; radius: number }
  | { kind: 'stun'; ms: number; radius: number }
  | { kind: 'magnet'; ms: number }
  | { kind: 'haste'; ms: number };

export interface CallInDef {
  /** What the button says under the ally's name. */
  label: string;
  /** What they shout when they arrive. */
  line: string;
  effect: CallInEffect;
}

/** Shared cooldown between any two call-ins, and the grace period at the start of a run. */
export const CALL_IN_COOLDOWN_MS = 30_000;
export const CALL_IN_FIRST_READY_MS = 20_000;

export const CALL_INS: Record<string, CallInDef> = {
  vee: { label: 'Free samples', line: 'Pickup range up. Take what you need!', effect: { kind: 'magnet', ms: 9000 } },
  deacon: { label: 'Steady hands', line: 'Hold still. I got you.', effect: { kind: 'shield', ms: 2500 } },
  nyx: { label: 'Lights out', line: 'Everybody freeze!', effect: { kind: 'stun', ms: 2200, radius: 260 } },
  sable: { label: 'Cut loose', line: 'Move it or lose it!', effect: { kind: 'haste', ms: 8000 } },
  mamajo: { label: 'Hot soup', line: 'Eat something, you are all bones.', effect: { kind: 'heal', pct: 0.3 } },
  bulbosa: { label: 'Big stomp', line: 'Coming through!', effect: { kind: 'nova', damage: 38, radius: 200 } },
  morrow: { label: 'Quiet word', line: 'Nobody touches you for a bit.', effect: { kind: 'shield', ms: 2000 } },
  cinder: { label: 'Spark show', line: 'Stand back, it is about to get bright.', effect: { kind: 'nova', damage: 44, radius: 190 } },
  pippa: { label: 'Patch up', line: 'Hold on, I have a bandage for that.', effect: { kind: 'heal', pct: 0.25 } },
  theo: { label: 'Big noise', line: 'Hands up, everyone!', effect: { kind: 'stun', ms: 2000, radius: 240 } },
  denny: { label: 'River tow', line: 'Everything shiny, this way!', effect: { kind: 'magnet', ms: 10000 } },
  ruth: { label: 'Market rush', line: 'Fresh supplies, no charge.', effect: { kind: 'heal', pct: 0.2 } },
  frankie: { label: 'Yard whistle', line: 'Pick up the pace!', effect: { kind: 'haste', ms: 7000 } },
  constance: { label: 'Order in the plaza', line: 'That is quite enough.', effect: { kind: 'stun', ms: 2400, radius: 250 } },
};

/** The rescued allies that have a call-in, in the order they were rescued. */
export function callInRoster(rescuedAllyIds: readonly string[]): string[] {
  return rescuedAllyIds.filter((id) => id in CALL_INS);
}
