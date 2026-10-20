/**
 * Integer-keyed spatial hash with open addressing over typed arrays.
 *
 * Replaces `Map<number, T[]>` for the per-step enemy grid and the obstacle
 * grid: lookups are a multiplicative hash plus a short linear probe (no
 * boxed-key hashing), and bucket arrays are recycled on `clear()` so a rebuild
 * allocates nothing once the grid has warmed up. Keys must be non-negative
 * 31-bit integers (the world's `cx * 4096 + cy` cell keys always are).
 */
const EMPTY = -1;

export class CellGrid<T> {
  /** Number of occupied cells. */
  size = 0;
  private keys: Int32Array;
  private buckets: Array<T[] | undefined>;
  /** Slot indices in insertion order, so iteration and `clear()` skip empties. */
  private used: number[] = [];
  private pool: T[][] = [];
  private bits: number;

  constructor(initialBits = 11) {
    this.bits = initialBits;
    this.keys = new Int32Array(1 << initialBits).fill(EMPTY);
    this.buckets = new Array(1 << initialBits);
  }

  get(key: number): T[] | undefined {
    const keys = this.keys;
    const mask = keys.length - 1;
    let slot = Math.imul(key, 0x9e3779b1) >>> (32 - this.bits);
    for (;;) {
      const k = keys[slot]!;
      if (k === key) return this.buckets[slot];
      if (k === EMPTY) return undefined;
      slot = (slot + 1) & mask;
    }
  }

  add(key: number, item: T): void {
    const keys = this.keys;
    const mask = keys.length - 1;
    let slot = Math.imul(key, 0x9e3779b1) >>> (32 - this.bits);
    for (;;) {
      const k = keys[slot]!;
      if (k === key) {
        this.buckets[slot]!.push(item);
        return;
      }
      if (k === EMPTY) break;
      slot = (slot + 1) & mask;
    }
    if ((this.size + 1) * 2 > keys.length) {
      this.grow();
      this.add(key, item);
      return;
    }
    const bucket = this.pool.pop() ?? [];
    bucket.push(item);
    keys[slot] = key;
    this.buckets[slot] = bucket;
    this.used.push(slot);
    this.size += 1;
  }

  /** Visit every occupied cell as (key, bucket). Do not add during iteration. */
  forEachCell(fn: (key: number, bucket: T[]) => void): void {
    const used = this.used;
    for (let i = 0; i < used.length; i += 1) {
      const slot = used[i]!;
      fn(this.keys[slot]!, this.buckets[slot]!);
    }
  }

  /** Occupied-cell count and indexed access, for allocation-free hot loops. */
  cellKeyAt(index: number): number {
    return this.keys[this.used[index]!]!;
  }

  cellBucketAt(index: number): T[] {
    return this.buckets[this.used[index]!]!;
  }

  clear(): void {
    const used = this.used;
    for (let i = 0; i < used.length; i += 1) {
      const slot = used[i]!;
      const bucket = this.buckets[slot]!;
      bucket.length = 0;
      this.pool.push(bucket);
      this.buckets[slot] = undefined;
      this.keys[slot] = EMPTY;
    }
    used.length = 0;
    this.size = 0;
  }

  private grow(): void {
    const oldKeys = this.keys;
    const oldBuckets = this.buckets;
    const oldUsed = this.used;
    this.bits += 1;
    this.keys = new Int32Array(1 << this.bits).fill(EMPTY);
    this.buckets = new Array(1 << this.bits);
    this.used = [];
    const mask = this.keys.length - 1;
    for (let i = 0; i < oldUsed.length; i += 1) {
      const old = oldUsed[i]!;
      const key = oldKeys[old]!;
      let slot = Math.imul(key, 0x9e3779b1) >>> (32 - this.bits);
      while (this.keys[slot] !== EMPTY) slot = (slot + 1) & mask;
      this.keys[slot] = key;
      this.buckets[slot] = oldBuckets[old];
      this.used.push(slot);
    }
  }
}
