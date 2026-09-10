import { describe, expect, it } from 'vitest';
import { suggestUsername } from './types';

describe('suggestUsername', () => {
  it('turns a name from Google or Apple into a handle', () => {
    expect(suggestUsername('Sam Rivera', 'sam@example.com')).toBe('sam.rivera');
  });

  it('falls back to the email local part when there is no name', () => {
    expect(suggestUsername('', 'wingfiend@example.com')).toBe('wingfiend');
  });

  it('strips accents and punctuation down to the allowed alphabet', () => {
    expect(suggestUsername("O'Brien-Smith", 'x@y.com')).toBe('o.brien.smith');
  });

  it('does not leave a leading or trailing separator', () => {
    expect(suggestUsername('  Ada  ', 'a@b.com')).toBe('ada');
  });

  it('gives up rather than suggest something invalid', () => {
    // Two characters is below the minimum, so there is nothing to offer.
    expect(suggestUsername('Al', 'al@example.com')).toBe('');
    // Nothing survives the allowed alphabet.
    expect(suggestUsername('张伟', '张伟@example.com')).toBe('');
  });

  it('never exceeds the 30-character limit', () => {
    const long = 'a'.repeat(50);
    expect(suggestUsername(long, 'x@y.com')).toHaveLength(30);
  });
});
