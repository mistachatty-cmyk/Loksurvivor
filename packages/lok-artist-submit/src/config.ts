import type { ArtistSubmitConfig, SubmitFormat } from './types';

/**
 * The Lok and GSix official owner account. Every ecosystem product sends
 * submissions here unless its manifest names a different recipient.
 * This address is visible to anyone who views the page source.
 */
export const LOK_SUBMISSIONS_RECIPIENT = 'mistachatty@gmail.com';

/** Longest single attachment worth asking for: most mail providers cap near 25 MB. */
export const DEFAULT_MAX_ATTACHMENT_MB = 20;

/** Preferred first, then the common alternatives. Add a row here to accept a new type everywhere. */
export const DEFAULT_FORMATS: readonly SubmitFormat[] = [
  { id: 'wav', ext: 'wav', preferred: true },
  { id: 'mp3', ext: 'mp3', preferred: false },
  { id: 'm4a', ext: 'm4a', preferred: false },
  { id: 'flac', ext: 'flac', preferred: false },
];

/** Loose on purpose: catches typos, leaves real validation to the mail server. */
const EMAIL_SHAPE = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/;

export function isEmailShaped(value: string): boolean {
  return value.length <= 254 && EMAIL_SHAPE.test(value);
}

export interface ArtistSubmitConfigInput {
  appKey: string;
  appLabel: string;
  recipient?: string;
  formats?: readonly SubmitFormat[];
  maxAttachmentMb?: number;
}

/** Fills the defaults and refuses a config that could never work, so a bad host fails loudly in development. */
export function createArtistSubmitConfig(input: ArtistSubmitConfigInput): ArtistSubmitConfig {
  const appKey = input.appKey.trim();
  const appLabel = input.appLabel.trim();
  if (!appKey) throw new Error('artist-submit: appKey is required');
  if (!appLabel) throw new Error('artist-submit: appLabel is required');

  const recipient = (input.recipient ?? LOK_SUBMISSIONS_RECIPIENT).trim();
  if (!isEmailShaped(recipient)) throw new Error(`artist-submit: recipient is not an email address: ${recipient}`);

  const formats = input.formats ?? DEFAULT_FORMATS;
  if (formats.length === 0) throw new Error('artist-submit: at least one format is required');
  const ids = new Set(formats.map((format) => format.id));
  if (ids.size !== formats.length) throw new Error('artist-submit: format ids must be unique');

  const maxAttachmentMb = input.maxAttachmentMb ?? DEFAULT_MAX_ATTACHMENT_MB;
  if (!Number.isFinite(maxAttachmentMb) || maxAttachmentMb <= 0) {
    throw new Error('artist-submit: maxAttachmentMb must be a positive number');
  }

  return { appKey, appLabel, recipient, formats, maxAttachmentMb };
}
