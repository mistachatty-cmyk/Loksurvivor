# Training Arena interaction contract

The default Training Arena is built around the user's weapon-dock sketch: fixed orange top bar, green-accented internal weapon scroller, and a large stage with operator left and target right. The green scroller is the room's default accent, but it must continue to respond to the selected theme. The Classic layout remains an optional saved choice.

## Weapon rack

- Spam starts off whenever the Training Arena loads and sits directly beside the details Lock control at the right of search. Challenges also start with Spam off. The player must turn it on explicitly.
- Clicking a weapon icon or weapon name activates it immediately; do not make a card click only select or open a detail panel.
- A separate, clearly visible disclosure control opens the weapon's details. It shows stats for its current level and any authored target debuff, status synergy, or operator affinity. Omit effects the weapon does not have.
- Lock closes any open detail panel and prevents details from opening. Rack activation remains available; clicking the disclosure spot while locked activates the weapon.
- Turning Spam off lets the current attack resolve and settle; turning it on during a live test resumes repeated attacks. Challenge entry never enables Spam automatically, and the challenge timer remains controlled by challenge mode.
- Show each weapon's current level as a compact badge on its icon button. Its detail panel has clamped level-down/level-up controls from 1–8. A separate All counter in the top bar raises or lowers every weapon to the same level and clears individual overrides.
- Animate level changes with a brief, restrained pop; honor `prefers-reduced-motion`. The level used for damage, challenge records, and weapon activation must match the badge.

## Stage and motion

- Keep the camera centered on the space between the operator and target; drag offsets are temporary and Center eases them back to this midpoint.
- The Dust Mite's home point is fixed, but its position must not be overwritten each simulation frame. Preserve knockback and allow any weapon-forced movement, then ease the target toward its anchor with a visible walk-back. Do not change combat health, collision, damage, or reward rules to create the visual effect.
- Let the live simulation run continuously while Spam is on. When Spam is off, complete pending attacks and wait for the target to return before ending the preview.

## Review checks

- Spam defaults off in the normal arena and in every challenge attempt, toggles cleanly while a weapon is firing, and remains reachable beside search on narrow screens.
- Icon/name activation fires without expanding details. The disclosure control opens/closes details; Lock closes details and converts the disclosure control into activation.
- Per-weapon stats match its selected level. Debuffs and status synergies appear only when the weapon defines them.
- Each weapon's badge, details counter, damage preview, and firing level agree. Individual level changes do not affect another weapon; the All counter sets every weapon to one level. Counters stop at level 1 and level 8, and reduced-motion disables the pop animation.
- Knockback visibly moves the target away from its spawn point and it walks back without a hard positional snap. Camera center remains the midpoint during the movement.
- Check desktop and phone widths, Main and Classic layouts, keyboard focus, and reduced-motion behavior.
