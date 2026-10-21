# @lok/artist-submit

A Lok ecosystem plugin that lets artists and creatives offer songs, music and
projects for any Lok or GSix app or game.

Status: **plugin v0.1, host #1 is 616 Survivor.** It is built so another product
that switches on the Lok ecosystem features can adopt it without copying code.

## What it does today

- An animated "Submit your music" call to action (the animation is `styles.css`).
- A short form: **creator name, email, song or project name.** Nothing else yet.
- Tells the artist which file types to send and how big an email can be.
- Builds a ready-to-send email to the Lok and GSix owner account and opens the
  artist's own email app with it filled in (a `mailto:` link), plus a "copy
  details" fallback for people with no email app.

It makes **no network calls and uploads nothing.** The artist attaches their own
file in their email app. That is on purpose: it costs nothing to run (see
`docs/LOK_COST_DISCIPLINE.md`) and there is nothing to host or moderate yet.

The recipient (`LOK_SUBMISSIONS_RECIPIENT` in `src/config.ts`) is
`mistachatty@gmail.com`. It is visible to anyone who reads the page source, so
expect some spam. A host may name a different recipient in its manifest.

## How it is split

| Piece | Where | Knows about |
| :-- | :-- | :-- |
| Core: types, config, validation, email builder, manifest opt-in | `src/*.ts` | Nothing: no React, no game, no network |
| Animation | `src/styles.css` | Only the CSS variable `--lok-artist-accent` |
| Host shell: dialog, layout, translated copy | in each app (616: `src/ui/ArtistSubmitCta.tsx`) | The host's UI kit and language files |

The core never contains player-facing words, except the email the team receives,
which is English on purpose. Hosts own their copy so it can be translated.

## Adopting it in another Lok product

1. Add the workspace dependency: `"@lok/artist-submit": "workspace:*"`.
2. Opt in through the app manifest (`lok.universe.json`), the same way
   `supporterBar` and `walletStrip` work. No block means the plugin is off:

   ```json
   "artistSubmit": { "mount": ["music"] }
   ```

   Allowed mount points: `music`, `studio`, `hub`, `shell`. Optional
   `"recipient": "someone@example.com"` overrides the ecosystem default.
3. Read it and build a config (616: `src/lib/lokFeatures.ts`):

   ```ts
   const feature = parseArtistSubmitFeature(manifest.artistSubmit);
   const config = createArtistSubmitConfig({ appKey: manifest.appKey, appLabel: manifest.label });
   ```

4. Write a thin shell: render only when `isMountedAt(feature, 'music')`, collect
   the three fields, call `validateSubmission`, then `buildSubmissionEmail` and
   `buildMailtoUrl`. Import `@lok/artist-submit/styles.css` and put the classes
   `lok-artist-btn` on the button and `lok-artist-eq` (with four `<i>` children)
   on the equalizer. Set `--lok-artist-accent` to the host's brand colour.
5. Add translated copy for the file types: one `artistSubmit.format.<id>` string
   per entry in `DEFAULT_FORMATS` (616's test fails if one is missing).

## Tests

`pnpm --filter @lok/artist-submit test` (plain `node:test`, no second runner).
They cover validation, header-injection safety, the email and link round trip,
config checks and the manifest opt-in.

## Not built yet (deliberately)

- More fields (links, genre, rights, socials). The owner asked for the minimum first.
- Server-side intake, storage, or an admin inbox. Today every submission is just an email.
- Spam protection. A `mailto:` link has no form to protect; revisit if a form backend is added.
- Publishing to npm. The package is `private` until the owner decides to share it.

When any of those arrive, the core's `ArtistSubmission` type is the one place to
extend, and hosts keep working because validation lives here.
