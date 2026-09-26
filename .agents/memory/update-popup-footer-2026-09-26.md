# Update popup + Hub footer — always mount both, always append changelog entries

`data/changelog.ts`'s `CHANGELOG` array is the single source of truth for
`CURRENT_VERSION`, the Hub footer's "v{X} · N updates" line, and every entry
shown in `UpdatePopup` and the Archive's Updates chapter. Its own header
comment already says how to add an entry (bump MINOR for a real update,
PATCH for a hotfix, just append — nothing else derives from anywhere else).
**Any PR that ships a player-visible change should append one entry.** This
was already true before this file existed; it just wasn't written down
anywhere outside that one code comment, and got skipped for a long stretch
of real commits as a result — don't let that happen again.

## The regression this file records

`HubScreen.tsx` used to render two things every time a player is on the Hub
(commit `700c99a`, "Add a rotating sponsor credit and an Updates footer on
the Hub"):

- `<UpdatePopup />`, mounted directly in the Hub's JSX — the blocking
  "Game Updated!" modal that shows once, automatically, the first time a
  player's `meta.lastSeenChangelogVersion` falls behind `CURRENT_VERSION`.
- A persistent footer button at the bottom of the Hub scroll area
  (`data-testid="footer-updates"`): `v{CURRENT_VERSION} · {N} updates ·
  brought to you by {rotating credit} — see what's new`, `onClick={() =>
  onOpen('unlocks')}` to jump into the Archive's Updates chapter on demand.

Commit `4098279` ("feat: add Tree Null area and Llamá Máma character") later
deleted both — the popup mount, the footer button, and their imports — as
unrelated collateral damage while touching the same file for an unrelated
feature. Nothing downstream caught it: no test renders `HubScreen` and
asserts on `UpdatePopup`/`footer-updates`, so the update flow silently went
dead (still fully implemented, just never mounted) for over a week of
further commits before a user report caught it. Restored 2026-09-26.

## Don't repeat this class of bug

- When editing `HubScreen.tsx` for an unrelated feature, do a real diff
  review before committing — an IDE-assisted "reorganize this file" or a
  large multi-feature commit is exactly how unrelated JSX (this footer, the
  player-level widget it also deleted in the same commit) gets dropped
  silently. Search the diff for removed lines, not just added ones.
- If you add a `data-testid` to something meant to be permanently visible
  (a footer, a persistent badge), that's a hint it deserves at least one
  smoke assertion (`HubScreen` renders → the testid exists) so a future
  unrelated edit fails loudly instead of silently.
- Every AI agent (not just a specific tool) working on this repo should
  treat "add a changelog entry" as part of *shipping* a player-visible
  change, the same way `pnpm typecheck`/`pnpm test` are part of shipping —
  not a separate, skippable chore.
