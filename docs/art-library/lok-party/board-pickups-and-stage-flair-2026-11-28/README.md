# Board pickups, speed lines and hanko seal (v0.43.8)

`pickups-speedlines-hanko.png`: left to right on the street strip: supply cache (gold crate), tailwind beacon (cyan pulse pillar), safe house (green arch), relic (violet faceted gem, narrows and widens to fake a turn) and a cache about to fade (dimmed). The amber ring under the first four is the hot-district ring. Bottom left: manga speed lines at 35 percent of the GO burst. Bottom right: the winner's hanko seal, full size and half stamped in (carved with the shape of the king character).

How it was made: all procedural Canvas2D from `drawSpawn` (party/boardArt.ts) and `drawSpeedLines` / `drawHanko` (party/stageArt.ts). Rendered by a temporary page that called those functions on one canvas, captured with headless Chrome, then deleted. Re-create by calling the same functions; nothing is a bitmap.
