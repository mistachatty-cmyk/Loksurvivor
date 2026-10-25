/**
 * Name and picture for the player card, taken from whatever the player signed in with.
 * Pictures are only ever shown from the sign-in providers' own image hosts, because a card
 * stored by one player is displayed on other players' screens.
 */
const AVATAR_HOSTS = [
  'cdn.discordapp.com',
  'avatars.githubusercontent.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'secure.gravatar.com',
];

/** The URL if it is https on a known picture host, else null. */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return AVATAR_HOSTS.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

interface UserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Prefers a username (Discord, GitHub) then the full name, then the part of the email before the @. */
export function displayNameFor(user: UserLike | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  const raw = text(meta.user_name) || text(meta.preferred_username) || text(meta.custom_claims && (meta.custom_claims as Record<string, unknown>).global_name) || text(meta.full_name) || text(meta.name) || text(user?.email).split('@')[0] || '';
  const cleaned = raw.replace(/[\u0000-\u001f<>]/g, '').slice(0, 24).trim();
  return cleaned || 'Player';
}

export function avatarFor(user: UserLike | null | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  return safeAvatarUrl(meta.avatar_url) ?? safeAvatarUrl(meta.picture);
}

/** Initials for the picture-less fallback circle. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** A stable hue from a name, so each player keeps the same fallback colour. */
export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
