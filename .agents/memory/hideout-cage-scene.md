# Hideout cage scene and crew callouts

The hideout defaults to a procedural cage scene (`MetaState.hideoutSceneStyle`, default `cage`). Draw the cage behind and lightly in front of the existing `HideoutPreview` actors; the silhouettes must remain readable, and the original room-biome backdrop stays available as `block`. Persist both scene style and speech-bubble visibility through `metaStore` so the dock and Settings controls stay in sync.

The cage uses the player's actual selected operator rig, enabled saved LokPets, and all rescued crew rigs. Crew keep their walk/idle/chatter animation even when hideout walking and prop interaction are disabled. In Old block mode, preserve the original room-local rescued-crew placement. Don't substitute static portraits or generic NPC art for saved characters.

“Call for help” and “Encourage crew” are hideout-only cosmetic commands. Help calls the selected LokPets toward the operator and has crew approach/react; encouragement makes crew react warmly. They must never grant rewards, modify combat, or advance progression. Their short reply bubbles are controlled by `hideoutSpeechBubblesEnabled`, default on. Turning chat off suppresses canvas bubbles without disabling the underlying animation or screen-reader announcement behavior for other hideout notes.

When extending this scene, verify:

- A fresh profile starts in Cage with actual operator and saved companions visible; rescued crew from every room joins the cage.
- Switching to Old block restores the old room art and room-specific cast, and both settings survive reload.
- Call for help gathers pets and moves crew toward the operator; Encourage produces a visible group response. Neither pays rewards.
- Turning speech bubbles off hides callouts and crew chat while leaving movement/emotes intact.
- Review desktop and narrow phone widths, reduced motion, few/no rescued crew, and a crowded rescued roster. Foreground bars must not make sprites or text hard to read.
