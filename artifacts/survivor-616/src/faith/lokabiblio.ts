// Lokabiblio core (docs/183): the shared scripture service for the Lok ecosystem. Pure logic, no DOM, no network.
// Faith features are OPTIONAL extras: they are off by default, free, and never required for any completion.
// Texts come from translations that are public domain (KJV, WEB) or licensed later. The seed below is a small
// King James Version set so the verse bar works offline today; the full-Bible data pipeline replaces `loadVerse` later.

export type Religion = 'none' | 'christian';
export const RELIGIONS: { id: Religion; name: string }[] = [{ id: 'none', name: 'Off' }, { id: 'christian', name: 'Christian' }];
export const isFaithOn = (r: Religion | undefined): boolean => r !== undefined && r !== 'none';

export type TranslationId = 'kjv' | 'web';
export const TRANSLATIONS: { id: TranslationId; short: string; name: string }[] = [{ id: 'kjv', short: 'KJV', name: 'King James Version' }, { id: 'web', short: 'WEB', name: 'World English Bible' }];
export interface Verse { ref: string; text: string; tr: TranslationId }

/** Seed verses, King James Version (public domain). Keys are the reference shown to the player. */
const KJV_SEED: Record<string, string> = {
  'John 3:16': 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  'Psalm 23:1': 'The LORD is my shepherd; I shall not want.',
  'Psalm 27:1': 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?',
  'Psalm 46:1': 'God is our refuge and strength, a very present help in trouble.',
  'Psalm 46:10': 'Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.',
  'Psalm 118:24': 'This is the day which the LORD hath made; we will rejoice and be glad in it.',
  'Psalm 119:105': 'Thy word is a lamp unto my feet, and a light unto my path.',
  'Proverbs 3:5': 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.',
  'Proverbs 3:6': 'In all thy ways acknowledge him, and he shall direct thy paths.',
  'Ecclesiastes 3:1': 'To every thing there is a season, and a time to every purpose under the heaven:',
  'Isaiah 41:10': 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.',
  'Jeremiah 29:11': 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
  'Micah 6:8': 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?',
  'Matthew 5:16': 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.',
  'Matthew 11:28': 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.',
  'Romans 8:28': 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
  '1 Corinthians 13:13': 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.',
  'Galatians 6:9': 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.',
  'Philippians 4:13': 'I can do all things through Christ which strengtheneth me.',
  'Colossians 3:23': 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;',
  '2 Timothy 1:7': 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.',
  'Hebrews 11:1': 'Now faith is the substance of things hoped for, the evidence of things not seen.',
  'Joshua 1:9': 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
};
export const SEED_REFS: string[] = Object.keys(KJV_SEED);

/** Normalise "john 3:16", "Jn 3:16" style input to the stored key. Only exact book names and a few short forms. */
const ALIAS: Record<string, string> = { ps: 'Psalm', psalms: 'Psalm', psalm: 'Psalm', prov: 'Proverbs', jn: 'John', matt: 'Matthew', rom: 'Romans', phil: 'Philippians', heb: 'Hebrews', isa: 'Isaiah', jer: 'Jeremiah', gal: 'Galatians', col: 'Colossians', eccl: 'Ecclesiastes', josh: 'Joshua' };
export function normRef(input: string): string | null {
  const m = /^\s*([1-3]?)\s*([A-Za-z]+)\s+(\d{1,3}):(\d{1,3})\s*$/.exec(input);
  if (!m) return null;
  const word = m[2].toLowerCase(), book = ALIAS[word] ?? word[0].toUpperCase() + word.slice(1);
  const key = `${m[1] ? m[1] + ' ' : ''}${book} ${Number(m[3])}:${Number(m[4])}`;
  return key;
}
export function verseOf(ref: string, tr: TranslationId = 'kjv'): Verse | null {
  const key = normRef(ref) ?? ref, text = KJV_SEED[key];
  return text ? { ref: key, text, tr } : null;
}

/** Day key in local time, YYYY-MM-DD. */
export const dayKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayNum = (k: string): number => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

/** The verse of the day: stable for a whole day, the same for everyone, steps through the set in order. */
export function dailyVerse(d: Date, tr: TranslationId = 'kjv'): Verse {
  const ref = SEED_REFS[((dayNum(dayKey(d)) % SEED_REFS.length) + SEED_REFS.length) % SEED_REFS.length];
  return verseOf(ref, tr) as Verse;
}
/** A different verse than `not`, picked with the supplied random number (0 to 1) so tests stay stable. */
export function otherVerse(not: string | undefined, rnd: number, tr: TranslationId = 'kjv'): Verse {
  const pool = SEED_REFS.filter((r) => r !== not);
  return verseOf(pool[Math.min(pool.length - 1, Math.floor(rnd * pool.length))], tr) as Verse;
}

/**
 * Verse streak with a weekly grace day (docs/183 section 5): a single missed day does not break the streak, as long as
 * no other missed day was forgiven in the previous 6 days. No penalty and no shame: a longer gap just starts fresh.
 * `days` are the day keys on which the player opened a verse.
 */
export function verseStreak(days: string[], today: string): number {
  const have = new Set(days.map(dayNum)); const t = dayNum(today);
  let cur = have.has(t) ? t : t - 1;           // today not read yet: the streak is still alive through yesterday
  if (!have.has(cur)) { if (!have.has(cur - 1)) return 0; cur -= 1; }   // yesterday missed too: only a one-day gap is forgiven
  let n = 0, lastGrace = -99;
  for (let i = cur; ; i--) {
    if (have.has(i)) { n++; continue; }
    if (i - lastGrace >= 7 || lastGrace === -99) { if (have.has(i - 1)) { lastGrace = i; continue; } }
    break;
  }
  return n;
}

/** The 66 books in order; index + 1 is the book number used by the data files (public/bible/kjv/<n>.json). */
export const BOOKS: readonly string[] = ['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const BOOK_KEYS = BOOKS.map(squash);
/** Find a book number (1 to 66) from a name or short form: "john", "ps", "1 cor". Returns 0 when nothing fits. */
export function bookNumber(name: string): number {
  const k = squash(name); if (k.length < 2) return 0;
  const a = squash(ALIAS[name.trim().toLowerCase()] ?? name);
  let i = BOOK_KEYS.indexOf(a); if (i >= 0) return i + 1;
  i = BOOK_KEYS.indexOf(a + 's'); if (i >= 0) return i + 1;           // "psalm" for Psalms
  const hits = BOOK_KEYS.map((b, j) => (b.startsWith(a) ? j : -1)).filter((j) => j >= 0);   // "1cor", "phil" style prefixes, only when unambiguous
  return hits.length === 1 ? hits[0] + 1 : 0;
}
export interface Place { book: number; chapter: number; verse: number }
/** "John 3:16" or "1 Cor 13:13" to a place. Chapter and verse are not range-checked here. */
export function locate(ref: string): Place | null {
  const m = /^\s*(.+?)\s+(\d{1,3})(?::(\d{1,3}))?\s*$/.exec(ref); if (!m) return null;
  const book = bookNumber(m[1]); return book ? { book, chapter: Number(m[2]), verse: Number(m[3] ?? 1) } : null;
}
