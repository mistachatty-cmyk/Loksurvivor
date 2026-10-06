---
name: Destroy Any Website reference notes
description: What the public fan clone ychisbest/destroy-any-website does and which ideas Demo Day took or rejected; licensing status.
---

Reference only. Read before borrowing anything from that repo.

## Licensing

`github.com/ychisbest/destroy-any-website` (one commit, ~2.7k lines) is a fan clone of Hugo Duprez's
*Destroy Any Website* (Sprite Fusion, launched 2026-09-29). It has **no LICENSE file**; only
`"license": "MIT"` in `package.json`. It replicates someone else's product, so Demo Day treats it as
**ideas only: no code is copied**, and uses its own name and credit link.

## How the clone works

Node/Cloudflare Worker `/proxy` fetches the target HTML, strips scripts/iframes/inline handlers, injects
`<base>`, and serves it into a same-origin iframe. `game.js` then wraps every word in a `<span>`, collects
element rects into a 64px spatial grid, and draws the game on a canvas over the iframe. Multiplayer is a
hand-rolled WebSocket relay (rooms of up to 6). Sprite Fusion's own version reportedly uses Cloudflare
Durable Objects for rooms and fails on CSP / frame-restricted / login-gated / JS-heavy sites, which is the
structural weakness of loading the page into the game.

## Taken (re-derived, not copied)

- Rect -> spatial grid; skip hidden elements; leaf tags (img/svg/video/input) as single blocks.
- HP scaled by area (`clamp(w*h/140, 18, 420)`); progress = destroyed area / total area.
- Skip containers that are a big share of the viewport; cap the total.
- Treat fixed/sticky elements specially (we skip them rather than rewriting their `position`).

## Rejected

- `<span>` per word on a live page (hydration breakage). Replaced by `Range` line chunks + `clip-path`.
- Proxy + iframe (the whole reason to run as an in-page overlay instead).
- Mutating `position` of fixed/sticky elements.

## Sprite Fusion's blog (2026-10-05)

"Pixel art rendering trick for a 90s look": render pixel art on a separate low-res layer, upscale
nearest-neighbour, stack over the hi-res page. No code is published. See `demo-day-overlay.md` for how
the overlay does it.
