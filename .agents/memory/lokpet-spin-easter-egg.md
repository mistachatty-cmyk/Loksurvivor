# LokPet spin easter egg (249)

**What:** tapping a LokPet in the hideout strip chains into a spin streak (taps within 700 ms).
- 6 taps in a streak -> dizzy (`dizzy` emote, wobbles and stumbles around for ~4.5 s).
- 14 taps in a streak -> sick (`sick` emote, lies still ~9 s, taps ignored, no care credit).
- The visit's lifetime spin count (`spinTotal`) left on **exactly 249** (no tap for 1.2 s) -> **super charged**:
  `SavedLokPet.superCharged = true`, which makes `applyPetExp` give +2% XP (`SUPER_CHARGE_EXP_MULT`) from every source.
  Overshooting 249 forfeits it for that visit (count is per visit, not saved).

**Why:** a hidden reward for playing with the pets that costs nothing to ignore. The sickness cap exists so mashing is a
risk, and the exact-number rule makes the jackpot a deliberate act. The bonus is deliberately tiny (2%).

**Where:** engine `game/engine/hideoutPets.ts` (`tapPet`, `checkSpinJackpot`, `SPIN_*`), strip `ui/HideoutPreview.tsx`,
persistence `superChargeLokPet` in `state/metaStore.tsx`, XP in `engine/petExpCurve.ts`. Tests: `hideoutCompanions.test.ts`.

**Related, not an easter egg:** pets also spin when a song starts (`state/songSpinSetting.ts`, Settings > Hideout),
by cadence, length and bond-based chance.

Never use the word "signal" in any copy here (see CLAUDE.md).
