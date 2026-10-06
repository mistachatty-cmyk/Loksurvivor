# Pullcheck — Survivor 616 pull request triage

Read this file before checking pull requests when the user says **“Pullcheck.”** It is the shared triage record for Claude, Codex, and other contributors. GitHub remains the source of truth for current PR state and checks.

## Routine

1. Fetch the current open PR list and current `main`; check only PRs targeting this repository and relevant to Survivor 616.
2. Exclude merged PRs and the closed, unmerged PRs in the table below. Their old branches are not merge candidates. Do not reopen or re-review them during routine Pullcheck. Revisit one only if the user explicitly names it or a new PR deliberately revives its work.
3. For each remaining open PR, read its purpose and discussion, compare its diff with current `main`, inspect reviews and checks, and determine whether it is ready, blocked, superseded, or intentionally archival. A green deployment alone does not establish merge readiness.
4. If a PR is intentionally not for merging, record its number, decision, reason, evidence link, and date here. If it is open, close it with that reason once the decision is established; do not leave it on the routine review queue. Keep any unfinished product work in an issue or a fresh PR.
5. Resolve routine conflicts and rerun relevant checks for merge candidates when the branch is ours to maintain. Report any remaining review or product decision before merging feature work.
6. Update this document when a PR changes category. Treat the live GitHub state as authoritative when a stored snapshot is older.

## Closed PRs excluded from routine Pullcheck

Reviewed 2026-10-06. All six were closed without merging. These are branch-level exclusions, not a decision to abandon every underlying idea.

| PR | Decision and reason | Follow-up or replacement |
| --- | --- | --- |
| [#14](https://github.com/mistachatty-cmyk/Loksurvivor/pull/14) | Do not merge the original customization branch. [#22](https://github.com/mistachatty-cmyk/Loksurvivor/pull/22) explicitly rebuilt and superseded it on current `main`. | #22 brought over themes, Lookbook basics, and Broadcast Contracts; [#24](https://github.com/mistachatty-cmyk/Loksurvivor/pull/24) expanded the Lookbook. |
| [#48](https://github.com/mistachatty-cmyk/Loksurvivor/pull/48) | Do not merge the stale Pet Whisperer branch. Its save and LokPet systems conflict with later work. | Open [issue #92](https://github.com/mistachatty-cmyk/Loksurvivor/issues/92) tracks a compatible rebuild. |
| [#70](https://github.com/mistachatty-cmyk/Loksurvivor/pull/70) | Do not merge the old soundtrack branch. It was superseded by a rebuild on current `main`. | [#90](https://github.com/mistachatty-cmyk/Loksurvivor/pull/90) merged the useful controls and fixed favorite persistence. |
| [#73](https://github.com/mistachatty-cmyk/Loksurvivor/pull/73) | Do not merge the stale, conflicted Studio project browser stack. Its persistence parent landed, but this browser slice needs current Studio APIs. | Open [issue #72](https://github.com/mistachatty-cmyk/Loksurvivor/issues/72) tracks a fresh implementation. |
| [#79](https://github.com/mistachatty-cmyk/Loksurvivor/pull/79) | Do not merge the old Archive navigation branch. | [#88](https://github.com/mistachatty-cmyk/Loksurvivor/pull/88) rebased its useful navigation change and merged. |
| [#111](https://github.com/mistachatty-cmyk/Loksurvivor/pull/111) | Do not merge the Arena hub branch. Its closure comment says commit `ea9239b` independently restored the same setup and screen changes on `main`, with more integration. | Keep the integrated `main` version. |

## Open PR at the last review

As of 2026-10-06, [#218 — Add GRPD Armory and its new hosts](https://github.com/mistachatty-cmyk/Loksurvivor/pull/218) was the only open PR. It is a **merge candidate**, not an exclusion. Its patch-note version conflict with `main` was resolved by merging current `main` into the PR branch and assigning the Armory entries versions 0.13.2, 0.13.3, and 0.14.0. Typecheck, production build, and 155 focused Armory, cast, and combat tests passed locally. Check the latest GitHub result and review the character art, lore, and Armory relocation flow before merging.
