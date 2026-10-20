import type { StackFrame } from './types';
import { topAppFrame } from './stack';

/** Two independent 32-bit FNV-1a hashes joined: 16 hex chars, plenty to tell crashes apart. */
export function hash16(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** Numbers and ids change from one occurrence to the next; the shape of the message does not. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/0x[0-9a-f]+/gi, '#')
    .replace(/\b[0-9a-f]{8,}\b/gi, '#')
    .replace(/\d+/g, '#')
    .replace(/(["'`]).*?\1/g, '$1…$1')
    .slice(0, 200);
}

/**
 * Stable across line-number churn: name, the shape of the message and where in the app it
 * happened (file and function, not line), so an edit above the crash does not make it "new".
 */
export function fingerprintOf(name: string, message: string, frames: readonly StackFrame[]): string {
  const top = topAppFrame(frames);
  return hash16(`${name}|${normalizeMessage(message)}|${top?.file ?? ''}|${top?.fn ?? ''}`);
}

export function reportIdOf(fingerprint: string): string {
  return `LER-${fingerprint.slice(0, 6).toUpperCase()}`;
}
