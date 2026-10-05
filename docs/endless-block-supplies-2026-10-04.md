# Endless block supplies

One building per generated Endless block carries a visible supply marker. The marker is on the facade and just inside the doorway. A player crosses the existing door gap and collects it while the street encounter continues. Classic building entry keeps its separate room behavior and does not use these finds.

## Rules

- The run seed and block coordinates choose one of the block's four buildings. Blocks without buildings have no supply.
- The prefab determines the reward: homes and clinics heal; laundromats provide water; crypts provide phosphor ore; industrial sites provide silicon alloy; digital sites provide cyber resin; other sites provide cred.
- Rewards use the existing pickup handlers. Values are 16 health, 12 cred, or one of the named resources. A full-health operator leaves a healing supply available for a later visit.
- A claimed building ID stays in the run's `claimedBuildingSupplies` set after its chunk unloads. Revisiting cannot pay again.
- The supply spot sits in the cleared door lane, inside the physical footprint. Generation tests check that it is clear of solid props across sample seeds.

## Interior readability pass

Walk-in floors now reflect building use: board seams for homes and social spaces, small tile for clinics and laundromats, heavy bars for industrial sites, branching traces for digital facilities, and broad stone blocks for the crypt. A low-contrast radial wash uses the prefab accent without bleaching actors or projectiles. A short strip inside each doorway marks the return route. Classic room entry retains its existing presentation.

## Next design checks

1. Measure supplies collected per 10 minutes in ordinary Endless runs before changing material values.
2. Add service interactions and authored mini encounters only where the prefab and district support them.
3. Check the floor and doorway contrast during dense combat on a real device, especially with reduced motion enabled.
4. Test all four door orientations with large enemies, movable cover, and projectiles.
