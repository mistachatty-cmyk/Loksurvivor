---
name: Impact physics contract
description: Durable rules for authored weapon force, prop physics, and enemy impact bursts.
---

Impact intensity is an authored 0–5 gameplay signal separate from damage. Enemy mass and optional resistance convert it into travel, while props resolve through explicit light, medium, heavy, or fixed profiles.

**Why:**  
Separating force from damage keeps weapon balance readable and lets harmless utility hits move scenery without creating reward bugs. Lethal impact bursts need secondary damage but must not create duplicate XP, cred, loot, or kill counts.

**How to apply:**  
Route new weapon hit paths through the shared impact value, keep fixed props indestructible, and send every actual enemy death through the existing single kill/reward function. Secondary burst hits must be below the burst threshold or otherwise guarded against recursion.