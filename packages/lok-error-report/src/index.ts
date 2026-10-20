/**
 * LokErrorReport: catch a crash, explain it in plain language, and store it wherever you
 * want. Core entry (no React, no Node): `@lok/error-report`. Also: `/sinks`, `/react`,
 * `/vite` (dev plugin) and `/ci` (CI log parsing). See README.md.
 */
export * from './types';
export { createReporter, type Reporter, type ReporterConfig, type ReporterEvent, type ReportInput } from './reporter';
export { parseStack, parseComponentStack, topAppFrame, normalizeFile, isAppFile } from './stack';
export { redact } from './redact';
export { fingerprintOf, reportIdOf, normalizeMessage, hash16 } from './fingerprint';
export { classify, isBenign, severityOf } from './classify';
export { toMarkdown, toPlainSummary, toFeedbackMessage, parseReportDoc, mergeIntoExisting, renderErrorsIndex, locationLabel, type ParsedReportDoc } from './format';
