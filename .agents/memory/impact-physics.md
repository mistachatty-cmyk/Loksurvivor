---
name: Impact physics contract
description: Durable rules for authored weapon force, prop physics, and enemy impact bursts.
---

Impact intensity is an authored 0–5 gameplay signal separate from damage. Enemy mass and optional resistance convert it into travel, while props resolve through explicit light, medium, heavy, or fixed profiles.

**Why:**  
Separating force from damage keeps weapon balance readable and lets harmless utility hits move scenery without creating reward bugs. Lethal impact bursts need secondary damage but must not create duplicate XP, cred, loot, or kill counts.

**How to apply:**  
Route new weapon hit paths through the shared impact value, keep fixed props indestructible, and send every actual enemy death through the existing single kill/reward function. Secondary burst hits must be below the burst threshold or otherwise guarded against recursion.

Clickable movable props are a one-shot mechanic: pointer selection primes the next player impact, which launches the prop **the way the hit sent it** -- away from the impact point -- with a strong velocity multiplier and a floor speed so even a light tap on a heavy prop visibly flies. Reversing that launch back toward whoever swung is the opt-in "Backspin Rig" mode (`World.physicsObjectReverseLaunch`, from a Quartermaster purchase plus a Settings toggle), **off by default**. Sweep the prop from its previous to current position when applying path damage.

**Why:**  
Launching away from the hit is what the input reads as -- the earlier reverse-by-default behavior was a mis-specification, not a design. Keeping the reverse as a purchased, switchable option preserves it for players who liked it without making it the thing an ordinary hit does. The feature still needs deliberate setup so it doesn't change ordinary weapon balance, and endpoint-only overlap misses enemies crossed between simulation frames.

**How to apply:**  
Keep priming gated by the persisted physics-interaction setting, consume the prime on the next qualifying player impact, and preserve the existing idempotent enemy-kill path for launch damage. A prop in flight **shoves the player and never damages them** (`shovePlayerFromMovingProp`, force into `player.kx/ky`): your own launched scenery is a mobility tool, so hitting yourself with it is a reposition, not a punishment.

Player dashes use a separate short-lived movement impulse: double-click/tap direction is derived from the player toward the tap, and each enemy swept by one dash receives one strong knockback impulse without dash damage.

**Why:**  
Dash movement should feel like a reliable crowd escape without introducing another damage or reward source, while per-dash hit tracking prevents repeated impulses across its animation window.

**How to apply:**  
Keep dash recovery and transition/outcome guards in the world command, preserve obstacle and arena collision handling, and render a directional trail so the input reads clearly on desktop and mobile.

Impact chains are bounded by a per-prop velocity budget: each lethal follow-through may double the current speed, but consumes 10% of the remaining budget, and a prop only becomes a persistent heat hazard after three completed cycles.

**Why:**  
The escalating feedback should feel explosive without becoming an unbounded recursive physics or reward system, while the three-cycle threshold makes the landed hazard an earned state rather than a common collision side effect.

**How to apply:**  
Keep chain contacts unique per enemy, route every death through the shared kill path, and keep the heat effect as a separate nearby damage/status tick rather than recursively re-launching the prop.