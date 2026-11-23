/**
 * Friend codes look like LOK-7K2M-Q9XD. The alphabet leaves out I, L, O, 0 and 1 so a code can be read
 * aloud or typed from a screenshot without mix-ups. The database issues them; this file only reads them.
 */
import { buildInviteUrl, parseInvite } from '../../../../../lib/lok-universe/src/invite';

export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const BODY = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{8}$`);

/** Accepts `lok-7k2m-q9xd`, `LOK 7K2M Q9XD`, `7K2MQ9XD` and returns `LOK-7K2M-Q9XD`, or null when it is not a code. */
export function normalizeFriendCode(input: string): string | null {
  const body = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LOK/, '');
  if (!BODY.test(body)) return null;
  return `LOK-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** The link a friend opens (or scans as a QR code) to land on the add-friend screen with the code filled in. */
export function friendShareUrl(code: string): string {
  return buildInviteUrl({ kind: 'friend', code }, 'survivor');
}

/** Reads a friend invite (`?go=friend.CODE`, or the older `?friend=CODE`) from a page address. */
export function friendCodeFromSearch(search: string): string | null {
  const invite = parseInvite(search, 'survivor');
  return invite?.kind === 'friend' ? invite.code : null;
}
