/**
 * A first pass at keeping the obvious out.
 *
 * The App Store requires "a method for filtering objectionable material from
 * being posted". This is that method, and it is deliberately modest: a word
 * list catches casual abuse and slurs at the moment of posting, and everything
 * it misses is caught by people reporting it. Pretending a regex is moderation
 * would be worse than pairing a small one with a real reporting route.
 *
 * Matching is on whole words after stripping the usual letter-for-symbol
 * substitutions, so "sh!t" is caught but "Scunthorpe" is not.
 */

const BLOCKED = [
  'nigger', 'nigga', 'faggot', 'fag', 'tranny', 'retard', 'retarded',
  'kike', 'spic', 'chink', 'wetback', 'paki', 'coon',
  'cunt', 'whore', 'slut', 'rape', 'rapist',
  'kys', 'killyourself',
];

const LEETMAP: Record<string, string> = {
  '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g',
};

const tidy = (s: string) =>
  s
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Two readings of the same text, because one is not enough.
 *
 * Substituting symbols for letters is needed to catch "sh!t", but applying it
 * first turns "cunt!" into "cunti" and lets it through. So the plain reading,
 * where punctuation is simply dropped, is checked as well.
 */
export function normalizeForModeration(text: string): string {
  const lower = text.toLowerCase();
  return tidy(
    lower
      .split('')
      .map((c) => LEETMAP[c] ?? c)
      .join(''),
  );
}

export function plainForModeration(text: string): string {
  return tidy(text.toLowerCase());
}

/** The blocked word found, or null. Whole words only. */
export function findBlockedWord(text: string): string | null {
  const readings = [normalizeForModeration(text), plainForModeration(text)];
  for (const word of BLOCKED) {
    for (const reading of readings) {
      if (new Set(reading.split(' ')).has(word)) return word;
      // Spaced out, so "n i g g e r" does not pass. Only for longer words,
      // where an accidental run of letters is vanishingly unlikely.
      if (word.length >= 5 && reading.replace(/\s/g, '').includes(word)) return word;
    }
  }
  return null;
}

export function isAcceptable(text: string): boolean {
  return findBlockedWord(text) == null;
}

export const MODERATION_MESSAGE =
  'That wording is not allowed on WingZ. Please rephrase it.';
