# @workspace/lok-focus-widget

A draggable focus-timer overlay for Survivor 616 — the game-side half of the
GSix hub's cross-app focus timer.

**This is a synced copy of `@lok/focus-widget` from the Gsixhub repo, not a
cross-repo import** — Loksurvivor and Gsixhub are separate repos/pnpm
workspaces, so there's no `workspace:*` link between them. The contract that
makes this work is the shared backend, not shared code: both packages read
and write the same two tables (`gsix_focus_settings`, `gsix_focus_sessions`)
in the same "LokServices" Supabase project that this game's own
`@workspace/lok-client`-based auth already talks to (see
`artifacts/survivor-616/src/lib/lokClient.ts`). If this engine's behavior
ever needs to change, mirror the change in both repos.

**No cross-origin messaging, and no shared session cookie either** — unlike
GSix's own subdomains, Survivor 616 isn't on `*.gsix.online`, so it can't
rely on `@lok/session`'s cookie. Instead: a player signs into Survivor 616
with the same account they used on the hub (both apps hit the same Supabase
project, so `auth.uid()` matches), and the widget just polls the same rows
under that id.

## Using it

```ts
import { mountFocusWidget } from "@workspace/lok-focus-widget";

// In the game's own render tree, once, after the user is signed in:
const handle = mountFocusWidget(document.body, { supabase: lokClient, userId: user.id });
// ...on unmount:
handle.destroy();
```

Renders nothing until there's an active session for that user on the hub —
safe to mount unconditionally once signed in.
