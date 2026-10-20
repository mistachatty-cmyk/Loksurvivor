export * from './types';
export {
  LOK_SUBMISSIONS_RECIPIENT,
  DEFAULT_MAX_ATTACHMENT_MB,
  DEFAULT_FORMATS,
  createArtistSubmitConfig,
  isEmailShaped,
  type ArtistSubmitConfigInput,
} from './config';
export { cleanField, validateSubmission, buildSubmissionEmail, buildMailtoUrl, buildEmailText } from './submission';
export { ARTIST_SUBMIT_MANIFEST_KEY, parseArtistSubmitFeature, isMountedAt } from './feature';
