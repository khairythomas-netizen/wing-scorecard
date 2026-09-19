import { describe, expect, it } from 'vitest';
import { findBlockedWord, isAcceptable, normalizeForModeration } from './moderation';

describe('posting filter', () => {
  it('lets ordinary wing talk through', () => {
    for (const text of [
      'Crispy skin, great heat, would go again',
      'Sauce was thin but the cook was perfect',
      'Best wings in Scunthorpe',
      'This place is sick',
      'Massive portions, bit pricey',
    ]) {
      expect(isAcceptable(text)).toBe(true);
    }
  });

  it('catches slurs and abuse', () => {
    expect(isAcceptable('you are a retard')).toBe(false);
    expect(isAcceptable('kys')).toBe(false);
  });

  it('sees through letter-for-symbol swaps', () => {
    // The whole reason a plain word list is not enough on its own.
    expect(isAcceptable('wh0re')).toBe(false); // zero for o
    expect(isAcceptable('r4pe')).toBe(false); // four for a
    expect(isAcceptable('$lut')).toBe(false); // dollar for s
  });

  it('does not flag a word merely containing a short blocked one', () => {
    // "fag" inside another word must not trip it, or the filter is useless.
    expect(isAcceptable('I ate a faggot of herbs')).toBe(false); // whole word
    expect(isAcceptable('That was a fagade of a wing')).toBe(true);
  });

  it('normalises punctuation and spacing', () => {
    expect(normalizeForModeration('C-R-I-S-P-Y')).toBe('c r i s p y');
  });

  it('is not fooled by trailing punctuation', () => {
    // Swapping symbols for letters turns "cunt!" into "cunti", which is why
    // the plain reading is checked too.
    expect(isAcceptable('what a cunt!')).toBe(false);
    expect(isAcceptable('sh!t wings')).toBe(true); // not on the list, but parsed
  });

  it('names the word it objected to, for a useful message', () => {
    expect(findBlockedWord('what a cunt')).toBe('cunt');
    expect(findBlockedWord('lovely wings')).toBeNull();
  });
});
