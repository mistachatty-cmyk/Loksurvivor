import type { Breadcrumb } from './types';
import { redact } from './redact';

/** A short memory of what happened just before a crash. */
export class Breadcrumbs {
  private items: Breadcrumb[] = [];

  constructor(private readonly max = 30) {}

  add(type: Breadcrumb['type'], text: string, at: number): void {
    this.items.push({ at, type, text: redact(text, 160) });
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max);
  }

  snapshot(): Breadcrumb[] {
    return this.items.map((b) => ({ ...b }));
  }

  clear(): void {
    this.items = [];
  }
}
