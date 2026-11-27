# Lok Party, explained

## The idea in one breath
Lok Party is a party mode for the whole Lok ecosystem. Four players (you, friends, or bots) move around a small board, race for crowns, and every few turns the board stops and everyone plays a 30 second minigame. Win the minigame and you get a head start on the board. It is built to be picked up in a minute, played in short bursts, and replayed because the board is different each time.

## How a match works
1. Pick a mode in the hub: Turbo Crown Blitz (solo vs bots), Play with friends (room link), or a minigame on its own.
2. Board: you roll, walk the spaces, choose a path at junctions, use items and your character's signature die, and buy crowns at the crown space.
3. Every round ends with a minigame (Ring Run Rush, The Lok Drop, more later). Results turn into board rewards.
4. After the match, your performance feeds shared progress: mastery, ladder rank, the pass, Victory Tokens.

## What it takes from Mario Party (and what it does not)
Taken:
- Board with shared goal (crowns, like stars) so luck and skill both matter.
- A minigame between turns so you are never waiting long.
- Catch-up: the minigame rewards help whoever is behind.
- Character-flavored dice and items for personality.

Changed on purpose:
- Matches are short. A full board game fits a coffee break, not an evening.
- Minigames are 30 seconds, one input family (move, jump, dash), and work on touch, keyboard and gamepad.
- Bots are first-class: each bot has its own difficulty (Match my rank, Easy to Master, or Random).
- No real-money or random-box reward in the loop; rewards are earned by playing.

## What it takes from Survivor 616
Characters, rigs and palettes (procedural, never raw art), the rank ladder, and Lok currency all come from the main game. Lok Party stays a separate folder (`src/party/`) so it can move to its own repo.

## Controls
Touch, mouse, keyboard and gamepad share one action layer (`lib/lokInput`). Game Mode fills the screen with a visible Exit, and the translucent input pad cycles mouse, keyboard, gamepad.

## Online
Friends mode shares a seed so every screen plays the same minigame and scores are merged. If a player drops, a bot finishes for them.

## Adding a minigame
See `docs/LOK_MINIGAME_CARTRIDGE.md`.
