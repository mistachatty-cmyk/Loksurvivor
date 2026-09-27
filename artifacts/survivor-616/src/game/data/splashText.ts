/**
 * Random one-liners shown next to the "Hideout" title on the Hub, Minecraft
 * main-menu-splash style -- pure flavor, zero mechanical meaning. Add as
 * many as you want; just append another string. One is picked at random
 * each time the Hub mounts.
 */
export const SPLASH_TEXT: string[] = [
  '616% survival rate not guaranteed!',
  'Grand Rapids never sleeps, but you might.',
  'Now with more cred than sense!',
  'Also try not dying!',
  'Fictionalized city, very real consequences.',
  "Shade's blade doesn't miss. You might.",
  'LokPets: legally distinct from your other pets.',
  "The dungeon's exit is reachable now. You're welcome.",
  'Endless mode: because one run was never enough.',
  'Kinetic Souls approved!',
  "Fatigue is temporary. That L is forever.",
  'Level up. Rank up. Show up.',
  'The Sanctum welcomes you back. Barely.',
  'Now loading: more content than sleep.',
  '59 operatives and counting.',
  'Patch notes! Actual, real patch notes!',
  'Rookie today, Mythic eventually.',
  'It runs in Canvas2D out of spite.',
  "We fixed the bug. Don't ask which one.",
  'Cred is temporary. Mastery is forever.',
];

export function pickSplashText(): string {
  return SPLASH_TEXT[Math.floor(Math.random() * SPLASH_TEXT.length)]!;
}
