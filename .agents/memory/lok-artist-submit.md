---
name: Lok artist-submit plugin
description: The "Submit your music" call to action is a reusable Lok ecosystem plugin (packages/lok-artist-submit), 616 Survivor is host #1; what it does, how a product opts in, and what was left out on purpose.
---

Read before changing the submit button, its email, or adding a second host.

## Decisions

- Owner request (2026-10-20): a micro-animated button for artists and creatives that
  offers songs, music or projects for 616 Survivor and any GSix or Lok app or game.
  Fields for now: creator name, email, song or project name. Nothing else yet. It must be
  built as a Lok ecosystem plugin first, later adoptable by any product that turns on the
  Lok ecosystem features.
- Shape: `packages/lok-artist-submit` (`@lok/artist-submit`) is the framework-free core
  (types, config, validation, email and `mailto:` builder, manifest opt-in) plus
  `styles.css` for the animation. A host writes its own thin shell. 616's shell is
  `src/ui/ArtistSubmitCta.tsx`, mounted in `MusicPanel` under the main soundtrack section.
- Opt-in is the app manifest, like `supporterBar`: `"artistSubmit": { "mount": ["music"] }`
  in `lok.universe.json`. No block means off. `src/lib/lokFeatures.ts` reads it. A bad
  config turns the feature off with a console warning; it must never throw at import.
- Recipient is `LOK_SUBMISSIONS_RECIPIENT` (`mistachatty@gmail.com`, the Lok and GSix
  owner account) in the package. It is public in the page source (spam risk), and a
  manifest may override it. Change the address in that one constant.
- No network and no upload: a `mailto:` link opens the artist's email app and the artist
  attaches the file. A website cannot attach files to `mailto:`, so the dialog says so.
  A "copy details" fallback covers people with no email app. This keeps it free to run.
- Accepted types are data (`DEFAULT_FORMATS`: WAV preferred, MP3, M4A, FLAC), 20 MB per
  email. Add a type by adding a row plus an `artistSubmit.format.<id>` string.
- Field text is stripped of line breaks and control characters before it reaches the
  email (header-injection guard) and capped at 120 characters (email 254).

## Gotchas hit while building

- This codebase's translation placeholders are `{{name}}`, not `{name}`. A single-brace
  placeholder prints literally (`goto.locked` has the same problem, left alone).
- Radix Dialog autofocuses the first field, which raises the phone keyboard over the
  instructions; the shell focuses the dialog itself instead.
- Keep the dialog at `max-h-[80dvh]`: the floating "Looks and LokPets" chip and the
  bottom dock sit above it on a phone.

## Left out on purpose

More fields, server intake, an admin inbox, spam protection, npm publishing (the package
is `private`), and a rights or licence checkbox beyond the one-line reminder.
