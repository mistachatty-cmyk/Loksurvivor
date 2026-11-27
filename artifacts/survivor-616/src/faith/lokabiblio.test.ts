import { describe, it } from 'node:test';
import { expect } from './expectShim';
import { verseOf, normRef, dailyVerse, otherVerse, verseStreak, isFaithOn, SEED_REFS } from './lokabiblio';

describe('lokabiblio', () => {
  it('is off unless a religion is chosen', () => { expect(isFaithOn(undefined)).toBe(false); expect(isFaithOn('none')).toBe(false); expect(isFaithOn('christian')).toBe(true); });
  it('looks up and normalises references', () => {
    expect(normRef('jn 3:16')).toBe('John 3:16'); expect(normRef('1 corinthians 13:13')).toBe('1 Corinthians 13:13');
    expect(verseOf('ps 23:1')?.text).toContain('shepherd'); expect(verseOf('Nowhere 1:1')).toBeNull(); expect(normRef('nonsense')).toBeNull();
  });
  it('has text for every seed reference', () => { for (const r of SEED_REFS) expect(verseOf(r)?.text.length).toBeGreaterThan(10); });
  it('daily verse is stable within a day and steps day to day', () => {
    const a = dailyVerse(new Date(2026, 10, 25, 1)), b = dailyVerse(new Date(2026, 10, 25, 23)), c = dailyVerse(new Date(2026, 10, 26, 9));
    expect(a.ref).toBe(b.ref); expect(c.ref).not.toBe(a.ref);
  });
  it('other verse never repeats the one given', () => { for (const r of [0, 0.5, 0.999]) expect(otherVerse('John 3:16', r).ref).not.toBe('John 3:16'); });
});

describe('verse streak with a weekly grace day', () => {
  const d = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
  it('counts consecutive days', () => { expect(verseStreak([d(23), d(24), d(25)], d(25))).toBe(3); });
  it('stays alive today before reading', () => { expect(verseStreak([d(23), d(24)], d(25))).toBe(2); });
  it('forgives one missed day', () => { expect(verseStreak([d(20), d(21), d(23), d(24)], d(24))).toBe(4); });
  it('does not forgive two missed days in a row', () => { expect(verseStreak([d(20), d(21), d(24)], d(24))).toBe(1); });
  it('forgives only one gap per week', () => { expect(verseStreak([d(18), d(20), d(22), d(23)], d(23))).toBe(3); });
  it('is zero after a long gap and for no history', () => { expect(verseStreak([d(10)], d(25))).toBe(0); expect(verseStreak([], d(25))).toBe(0); });
});

import { bookNumber, locate, BOOKS } from './lokabiblio';
describe('finding places in the Bible', () => {
  it('has 66 books', () => { expect(BOOKS.length).toBe(66); });
  it('finds books by name and short form', () => {
    expect(bookNumber('John')).toBe(43); expect(bookNumber('psalm')).toBe(19); expect(bookNumber('ps')).toBe(19); expect(bookNumber('1 cor')).toBe(46);
    expect(bookNumber('Revelation')).toBe(66); expect(bookNumber('1 John')).toBe(62); expect(bookNumber('zzz')).toBe(0); expect(bookNumber('j')).toBe(0);
  });
  it('locates references', () => { expect(locate('John 3:16')).toEqual({ book: 43, chapter: 3, verse: 16 }); expect(locate('Psalm 23')).toEqual({ book: 19, chapter: 23, verse: 1 }); expect(locate('nope')).toBeNull(); });
});

// The data build scripts (and their tests) live in Queens N Kings; the Bible files here are a copy of its output.
