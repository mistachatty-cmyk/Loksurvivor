# Character Studio v3 contract

## Preserved v2 baseline

The merged Forge revision is tagged `survivor616-character-designer-v2` at `7010d98bd2c2951f5a65b95e876b2513a17609e4`. It is the migration and visual comparison baseline. Classic v1 renders the original simple operator rig. Operator detailed v2 adds feature choices to the procedural humanoid rig; it does not contain per-pixel animation. Enemy Styled v2 changes a base enemy's palette, leaving its rig, stats, and behavior intact. The authored operator and enemy rosters remain canonical. Forged operators and recolors are separate player records.

The existing local save key `survivor616.forge.v1`, `FORGE1` share code, saved operators, enemy recolors, and Classic v1 selector stay valid. V3 uses a separate IndexedDB database and never rewrites the Forge payload. A legacy save archive still imports its v1 Forge object. Importing a v2 design into v3 creates a new draft linked by its source kit; it does not upgrade or delete the old object. V3 projects are not serialized into the 1 MB shared progression save.

## Project data and validation

`src/game/studio/v3Project.ts` owns format version 3. It records kind, base kit or enemy ID, seed and prompt choices, 16-color palette, named layers with pivots and draw order, eight editable directions, animation frames with per-frame timing and layer pixels, revision lineage, remix choice, and review state. Logical art is 48 × 48 pixels. The editor provides a toggleable pixel grid, X/Y placement from the top-left origin, and a square brush from 1 to 8 pixels; 4 pixels is suggested for blocking larger shapes. Drawing and erasing are clipped to the map, brush stamps replace pixels at the same coordinates, and each pointer stroke is one undo step. Opening a different project clears the old undo history. These controls do not change the V3 project format. The six generator rig families are humanoid, quadruped, blob, insectoid, floating, and winged. Style choices are cute, creepy, street, industrial, whimsical, and Null. Prompts select within this curated system; no image is fetched or uploaded.

Creators can start with generated art or a blank 48 × 48 project. The pointer canvas accepts touch, mouse, and pen input; fast movements fill every cell between sampled points. Right click and a stylus eraser erase. The selected palette color is editable, and creators can add, name, reorder, show, hide, clear, or remove layers. Shared palette and layer changes clear all frame approvals because they can alter every view. The editor supports up to 16 layers, matching the account validator.

Every direction requires idle 4, walk 6, attack 4, hurt 2, and death 8 frames, for 192 reviewed frames. Generation prefills editable art but never approves it. Editing a frame revokes that frame's approval. A complete project has all required frames approved and no structural validation errors. Only complete reviewed revisions may enter runs, submission, adoption, or public profile art. Operators retain the selected unlocked kit's gameplay. Enemy work replaces only the selected base enemy's appearance and retains its authored behavior and stats.

The frame timeline can copy the current clip from the selected direction to the other seven directions. This replaces those clips, clears their approvals, and counts as one undoable edit; the source direction remains unchanged.

It can also copy the selected frame's art and layer transforms to the other frames in that clip. Each destination keeps its timing, needs fresh review, and can be restored with one undo.

After reviewing a clip, its frames can be approved together. A project with all 192 frames approved and visible art can be submitted from the editor. Submission saves the device draft, syncs it to the account, then queues an immutable revision for staff review. Approved revisions feed the Survivor 616 and GSix.online galleries; rejected or removed revisions stay out of public queries.

## Account and publication boundary

IndexedDB is the device draft cache. Account drafts need owner-scoped records and optimistic revision checks so a later device upload cannot silently overwrite edits. A submitted revision is immutable. Staff must approve media before public gallery, profile, or share use. A snapshot from a private draft needs the same review. A takedown hides a revision immediately and removes its public media access.

Adoption is an account transaction: one 100 LokToken debit for a nonself adoption; publisher receives 20 LokTokens, 20 permanent Rep, and 100 Survivor616 Cred. A fork also pays its immediate parent creator 5 LokTokens when that account differs. A unique ownership record and idempotency key make retries free. Adopted ownership references an immutable revision; eligible later revisions can be offered without a second debit. Cred grants are account ledger entries and must be merged monotonically with game progression so a stale device save cannot erase them.

The first completed saved creation awards the Creator badge and mailbox message exactly once. A creative-event registry supports future GSix apps. The companion celebration is triggered by that recorded event, with a text alternative. The network gallery follows the in-game gallery; both read the same approved revisions.

## Baselines and acceptance

- Keep v1 and detailed v2 operator portraits and Styled v2 enemy palettes as visual baselines. Their existing fixtures and `FORGE1` decoder remain unchanged.
- Validate deterministic generation, all 192 approvals, edit invalidation, malformed frames, and save/reload in IndexedDB.
- Exercise each direction and clip in gameplay and preview, including reduced motion and touch editing.
- Test account ownership, moderation, adoption retries, self-adoption, fork payout, badge idempotency, and cross-device Cred with real database transactions before enabling paid adoption.
- Generate roster PNG and vertical MP4 from the same character renderer; export jobs must provide attribution and a still poster.
