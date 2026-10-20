/**
 * Types for the Lok "artist submit" plugin.
 *
 * Nothing here knows about React, a game, or a network: the plugin only turns
 * what an artist types into a ready-to-send email. A host app supplies its own
 * dialog and calls into this package (see README.md).
 */

/** One file type the team can accept. Display copy lives in the host app so it can be translated. */
export interface SubmitFormat {
  /** Stable id, also used by hosts to look up their translated label. */
  id: string;
  /** File extension without the dot, for example `wav`. */
  ext: string;
  /** True for the format we would like to receive first. */
  preferred: boolean;
}

/** Everything a host can tune. Build one with `createArtistSubmitConfig`. */
export interface ArtistSubmitConfig {
  /** Short stable key of the host app, for example `survivor616`. Lands in the email subject. */
  appKey: string;
  /** Human name of the host app, for example `616 Survivor`. Lands in the email. */
  appLabel: string;
  /** Where submissions go. Defaults to the Lok and GSix owner account. */
  recipient: string;
  /** File types to ask for. */
  formats: readonly SubmitFormat[];
  /** Largest single email attachment to ask for, in megabytes. */
  maxAttachmentMb: number;
}

/** Raw form values, as typed. */
export interface ArtistSubmissionInput {
  creatorName: string;
  creatorEmail: string;
  /** Name of the song, or of the project when it is more than one song. */
  workTitle: string;
}

export type SubmissionField = keyof ArtistSubmissionInput;
export type SubmissionErrorCode = 'required' | 'invalidEmail';
export type SubmissionErrors = Partial<Record<SubmissionField, SubmissionErrorCode>>;

/** Cleaned values, safe to put in an email. */
export interface ArtistSubmission extends ArtistSubmissionInput {}

export type ValidationResult =
  | { ok: true; value: ArtistSubmission }
  | { ok: false; errors: SubmissionErrors };

/** A finished email, before it is turned into a link or copied. */
export interface SubmissionEmail {
  to: string;
  subject: string;
  body: string;
}

/** Where in a host app the button may appear. Hosts add values as they gain places to put it. */
export type ArtistSubmitMount = 'music' | 'studio' | 'hub' | 'shell';

/** What a host's `lok.universe.json` says about this plugin. */
export interface ArtistSubmitFeature {
  enabled: boolean;
  mounts: readonly ArtistSubmitMount[];
  /** Optional per-host override of the recipient. Absent means the ecosystem default. */
  recipient?: string;
}
