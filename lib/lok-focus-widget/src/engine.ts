import type { SupabaseClient } from "@supabase/supabase-js";
import type { FocusPosition, FocusSession, FocusWidgetHandle } from "./types";

const POLL_MS = 5000;
const SAVE_DEBOUNCE_MS = 400;
const DEFAULT_POSITION: FocusPosition = { x: 88, y: 88 };

async function fetchPosition(supabase: SupabaseClient, userId: string): Promise<FocusPosition> {
  const { data } = await supabase
    .from("gsix_focus_settings")
    .select("pos_x,pos_y")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT_POSITION;
  return { x: Number(data.pos_x), y: Number(data.pos_y) };
}

async function savePosition(supabase: SupabaseClient, userId: string, pos: FocusPosition): Promise<void> {
  await supabase
    .from("gsix_focus_settings")
    .upsert({ user_id: userId, pos_x: pos.x, pos_y: pos.y, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

async function fetchSession(supabase: SupabaseClient, userId: string): Promise<FocusSession | null> {
  const { data } = await supabase
    .from("gsix_focus_sessions")
    .select("game_app_key,label,duration_ms,started_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    gameAppKey: data.game_app_key,
    label: data.label,
    durationMs: Number(data.duration_ms),
    startedAt: new Date(data.started_at).getTime(),
  };
}

/**
 * Starts (or replaces) the active focus session for `userId`. GSix's own hub
 * is the only caller of this today (its Focus Console) — kept here too since
 * this package is a synced copy of `@lok/focus-widget`, not a cross-repo
 * import (Loksurvivor and Gsixhub are separate repos/workspaces).
 */
export async function startFocusSession(
  supabase: SupabaseClient,
  userId: string,
  session: { gameAppKey: string | null; label: string | null; durationMs: number },
): Promise<void> {
  await supabase.from("gsix_focus_sessions").upsert(
    {
      user_id: userId,
      game_app_key: session.gameAppKey,
      label: session.label,
      duration_ms: session.durationMs,
      started_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

export async function endFocusSession(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from("gsix_focus_sessions").delete().eq("user_id", userId);
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Mounts the draggable focus pill into `host` (pass `document.body` — the
 * pill positions itself `fixed`, so where it's appended in the DOM doesn't
 * matter). Reads placement and the active session from the `gsix_focus_settings`
 * / `gsix_focus_sessions` tables in the shared LokServices Supabase project —
 * the same rows GSix's hub reads/writes. There is no cross-origin messaging;
 * whichever Supabase-authenticated `userId` is passed in just needs to match
 * the account that started the session on the hub (same sign-in, this repo's
 * own `@workspace/lok-client`-based auth here, not a shared session cookie —
 * Survivor 616 isn't a `*.gsix.online` subdomain).
 *
 * Renders nothing (returns a no-op handle) while there's no active focus
 * session for this user, so mounting this unconditionally on load is safe;
 * it stays invisible for a signed-out visitor or one who hasn't started a
 * session from the hub.
 */
export function mountFocusWidget(
  host: HTMLElement,
  options: { supabase: SupabaseClient; userId: string },
): FocusWidgetHandle {
  const { supabase, userId } = options;

  const pill = document.createElement("div");
  pill.setAttribute("role", "timer");
  pill.style.position = "fixed";
  pill.style.zIndex = "2147483000";
  pill.style.display = "none";
  pill.style.cursor = "grab";
  pill.style.userSelect = "none";
  pill.style.padding = "10px 16px";
  pill.style.borderRadius = "999px";
  pill.style.background = "rgba(6,7,10,0.88)";
  pill.style.border = "1px solid rgba(100,255,251,0.4)";
  pill.style.color = "#fffbf0";
  pill.style.font = "600 13px system-ui, sans-serif";
  pill.style.letterSpacing = "0.02em";
  pill.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";
  pill.style.backdropFilter = "blur(6px)";
  host.appendChild(pill);

  let position: FocusPosition = DEFAULT_POSITION;
  let session: FocusSession | null = null;
  let disposed = false;
  let tickRaf = 0;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function place() {
    pill.style.left = `${position.x}%`;
    pill.style.top = `${position.y}%`;
    pill.style.transform = `translate(-${position.x}%, -${position.y}%)`;
  }

  function render() {
    if (!session) {
      pill.style.display = "none";
      return;
    }
    const remaining = session.durationMs - (Date.now() - session.startedAt);
    if (remaining <= 0) {
      pill.style.display = "none";
      session = null;
      return;
    }
    pill.style.display = "block";
    pill.textContent = `⏱ ${formatRemaining(remaining)}${session.label ? " · " + session.label : ""}`;
  }

  function tick() {
    if (disposed) return;
    render();
    tickRaf = requestAnimationFrame(tick);
  }

  // ------------------------------------------------------------ drag to move
  let dragging = false;
  let pointerId: number | null = null;

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    pointerId = event.pointerId;
    pill.setPointerCapture(event.pointerId);
    pill.style.cursor = "grabbing";
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging || event.pointerId !== pointerId) return;
    position = {
      x: Math.min(98, Math.max(2, (event.clientX / window.innerWidth) * 100)),
      y: Math.min(98, Math.max(2, (event.clientY / window.innerHeight) * 100)),
    };
    place();
  }
  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    pill.style.cursor = "grab";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void savePosition(supabase, userId, position);
    }, SAVE_DEBOUNCE_MS);
  }

  pill.addEventListener("pointerdown", onPointerDown);
  pill.addEventListener("pointermove", onPointerMove);
  pill.addEventListener("pointerup", onPointerUp);

  // ------------------------------------------------------------------- poll
  async function refresh() {
    if (disposed) return;
    const [nextPosition, nextSession] = await Promise.all([
      fetchPosition(supabase, userId),
      fetchSession(supabase, userId),
    ]);
    if (disposed) return;
    if (!dragging) {
      position = nextPosition;
      place();
    }
    session = nextSession;
    render();
  }

  place();
  void refresh();
  tick();
  const poll = setInterval(refresh, POLL_MS);

  return {
    destroy() {
      disposed = true;
      clearInterval(poll);
      clearTimeout(saveTimer);
      cancelAnimationFrame(tickRaf);
      pill.removeEventListener("pointerdown", onPointerDown);
      pill.removeEventListener("pointermove", onPointerMove);
      pill.removeEventListener("pointerup", onPointerUp);
      pill.remove();
    },
  };
}
