---
name: Demo Day future modes (documented, not built)
description: Two planned Demo Day modes — walking off the page edge into another website (site-hop), and walking between gsix.online pages — with the constraints and safety rules that must hold before either is built.
---

Read before building anything that moves the player between pages or sites. **Neither mode exists yet.** The v2
milestone M3 deliberately exposes an `onLevelComplete` + `exits` abstraction so these plug in without a rewrite.

## Mode A — Site-Hop ("walk off the page into another website")

- After a level (one page) is complete, the page's four edges (top, bottom, left, right) open as exits. Walking
  through one lands on a whole other website. An exit can be a fixed destination or a **random hop** (a toggle).
- **Visit log:** an ordered trail of sites visited in this journey, each with its teardown report card and the level
  state, plus a "back" exit and a list to return to any earlier site. A "teardown atlas" of past sites is local only.
- **Requires an MV3 extension.** A full navigation destroys the page's JS realm, so only a content script re-injected
  on every page, with the run state (character, level, xp, weapons, drops, combo, settings) in `chrome.storage` or
  the service worker, can carry a run across sites. A bookmarklet cannot persist. Iframing other sites is mostly
  blocked (X-Frame-Options / CSP `frame-ancestors`), and a proxy ("browser inside the game") was explicitly rejected
  in `destroy-reference-notes.md`.
- **Safety and privacy, all non-negotiable:** the visit log is sensitive. Extension storage only, **opt-in**, per-site
  deny list, clearable, **excluded from incognito**, never sent to any server. Run `sensitivePageReason()` *before*
  landing and on every soft navigation. Random-hop destinations come from a **curated allow-list**, never arbitrary
  URLs. Page writes stay reversible (v2's untouched-page design makes this easier).

## Mode B — GSix navigation ("walk left/right to navigate gsix.online, destroying each page")

- On gsix.online the hub's routes become a walkable map (`/`, `/arcade`, `/games/*`, `/leaderboards`, `/passport`,
  `/lokdex`, `/blog`, `/showcase`, `/community`, ...) laid out as a route graph built from the header/footer links.
  The overlay persists across routes because the hub is a Next.js App Router app: navigation is soft (`next/link`)
  and the layout persists.
- **Navigate with anchors or `router.push`, never `window.location`** (a full reload would kill the overlay).
  **Re-scan on route change:** wrap `history.pushState`/`replaceState`, listen to `popstate`, and observe `<main>`/`body`
  with a `MutationObserver` (the hub's `scroll-parallax.tsx` already does this). After a swap, hole masks and element
  refs point at detached nodes, so reset per-page state and rebuild.
- **Interactivity:** an optional **Use** key clicks the nearest interactive element in reach (open a game card, follow
  a link, switch a leaderboard tab). Allow-listed to gsix.online, never on form submits or sign-in / payment UI.
- **Never destroy or hide ad slots on gsix.online** (AdSense policy; see the hub's `POPOUTS.md`). Fixed widgets
  (Tamagotchi dock, music button, consent banner, sticky header, pop-outs) are already skipped by the scanner.
  Treat `AuthMenu`, `SignIn` and Google One Tap as protected UI.
- **Open questions before building:** what a "level" means on a hub page (per route vs per section), whether the
  route map is fixed or shuffled, and how interactivity interacts with the report / leaderboard flow.
