/** Keep hot entries when a crowd exceeds capacity, rather than evicting the next frame's first entry. */
export class PropTextureCache<T> {
  private readonly entries = new Map<string, { value: T; usedAt: number }>();
  private clock = -Infinity;
  constructor(private readonly limit = 24, private readonly coldAfterMs = 250) {}

  get size() { return this.entries.size; }

  getOrCreate(key: string, now: number, create: () => T): T {
    // A new run can restart its elapsed clock and reuse actor IDs.
    if (now < this.clock) this.entries.clear();
    this.clock = now;
    const entry = this.entries.get(key);
    if (entry) { entry.usedAt = now; return entry.value; }
    const value = create();
    if (this.entries.size >= this.limit) {
      let cold: string | undefined;
      for (const [candidateKey, candidate] of this.entries) {
        if (now - candidate.usedAt > this.coldAfterMs) { cold = candidateKey; break; }
      }
      // Overflow is painted uncached. The hot set remains intact for the next frame.
      if (cold === undefined) return value;
      this.entries.delete(cold);
    }
    this.entries.set(key, { value, usedAt: now });
    return value;
  }
}
