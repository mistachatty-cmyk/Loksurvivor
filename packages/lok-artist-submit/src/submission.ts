import { isEmailShaped } from './config';
import type {
  ArtistSubmission,
  ArtistSubmissionInput,
  ArtistSubmitConfig,
  SubmissionEmail,
  SubmissionErrors,
  ValidationResult,
} from './types';

const NAME_MAX = 120;
const EMAIL_MAX = 254;

/**
 * Makes one typed value safe for an email: control characters (including line
 * breaks, the way header injection sneaks in) become spaces, runs of spaces
 * collapse, the ends are trimmed and the length is capped.
 */
export function cleanField(value: string, max = NAME_MAX): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

export function validateSubmission(input: ArtistSubmissionInput): ValidationResult {
  const value: ArtistSubmission = {
    creatorName: cleanField(input.creatorName),
    creatorEmail: cleanField(input.creatorEmail, EMAIL_MAX),
    workTitle: cleanField(input.workTitle),
  };
  const errors: SubmissionErrors = {};
  if (!value.creatorName) errors.creatorName = 'required';
  if (!value.workTitle) errors.workTitle = 'required';
  if (!value.creatorEmail) errors.creatorEmail = 'required';
  else if (!isEmailShaped(value.creatorEmail)) errors.creatorEmail = 'invalidEmail';
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** The email the owner receives. English on purpose: it is read by the team, not by the artist. */
export function buildSubmissionEmail(submission: ArtistSubmission, config: ArtistSubmitConfig): SubmissionEmail {
  const accepted = config.formats.map((format) => format.ext.toUpperCase()).join(', ');
  return {
    to: config.recipient,
    subject: `Music submission: ${submission.workTitle} - ${submission.creatorName} [${config.appLabel}]`,
    body: [
      `New music submission via ${config.appLabel} (${config.appKey}).`,
      '',
      `Creator name: ${submission.creatorName}`,
      `Contact email: ${submission.creatorEmail}`,
      `Song / project: ${submission.workTitle}`,
      '',
      `Attach the file to this email (${accepted}), or paste a download link.`,
    ].join('\n'),
  };
}

/** A `mailto:` link that opens the artist's own mail app with everything filled in. */
export function buildMailtoUrl(email: SubmissionEmail): string {
  const query = `subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  return `mailto:${encodeURIComponent(email.to).replace(/%40/g, '@')}?${query}`;
}

/** Plain text for the "copy details" fallback, for people with no mail app set up. */
export function buildEmailText(email: SubmissionEmail): string {
  return `To: ${email.to}\nSubject: ${email.subject}\n\n${email.body}`;
}
