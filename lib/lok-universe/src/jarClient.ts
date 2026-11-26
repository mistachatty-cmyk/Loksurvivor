// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
/**
 * Client for the server Boost Jar (edge function `lok-jar`, SQL 09_boost_jar.sql). PROPOSED until deployed.
 * The server counts plays from the ledger, so the client never sends counts. It only asks for state and asks to activate.
 * Signed-out or offline players get `{ ok: false }`, and the game falls back to the local preview in boostJar.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JarNudgeInput } from "./jarNudge";

export interface ServerJarGame { app: string; unit: string; count: number; bonus: number; next: { at: number; bonus: number; remaining: number } | null }
export interface ServerJarState {
  ok: true;
  fill: number;
  level: number;
  games: ServerJarGame[];
  minutes: number;
  earned_24h: number;
  payout: number;
  can_activate: boolean;
  reason: "boost_running" | "cooldown" | "empty" | null;
  retry_at: string | null;
  boost: { pct: number; starts_at: string; ends_at: string } | null;
  server_time: string;
}
export type JarStateResult = ServerJarState | { ok: false; error: string };
export type JarActivateResult =
  | { ok: true; amount: number; pct?: number; minutes?: number; boost_ends_at?: string; balance: number; replay?: boolean }
  | { ok: false; error: string; retry_at?: string | null };

async function call<T>(client: SupabaseClient, body: Record<string, unknown>): Promise<T | { ok: false; error: string }> {
  try {
    const { data, error } = await client.functions.invoke("lok-jar", { body });
    if (error) return { ok: false, error: error.message || "network" };
    return data as T;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export const fetchJarState = (client: SupabaseClient) => call<ServerJarState>(client, { action: "state" });

/** One idempotency key per tap intent: reuse it on a retry so a dropped connection cannot pay twice. */
export const newJarIdemKey = () => `jar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const activateJar_server = (client: SupabaseClient, idemKey: string) => call<JarActivateResult>(client, { action: "activate", idemKey });

/** Map the server state to the input the nudge module wants. Pass the biggest remaining step across games. */
export function nudgeInputFromServer(s: ServerJarState, cap = 0.5): JarNudgeInput {
  const steps = s.games.filter((g) => g.next).sort((a, b) => (a.next!.remaining) - (b.next!.remaining));
  const near = steps[0];
  const t = (iso: string | null) => (iso ? Date.parse(iso) : undefined);
  return {
    fill: s.fill,
    full: s.fill >= cap - 1e-9,
    payout: s.payout,
    boostMinutes: s.minutes,
    canActivate: s.can_activate,
    cooldownEndsAt: s.reason === "cooldown" ? t(s.retry_at) : undefined,
    boost: s.boost ? { pct: s.boost.pct, endsAt: Date.parse(s.boost.ends_at) } : undefined,
    nextStep: near ? { remaining: near.next!.remaining, unit: near.unit, bonus: near.next!.bonus } : undefined,
  };
}
