import { describe, expect, it } from 'vitest';
import { field, isISODate } from './form-state';

describe('isISODate', () => {
  it('godtar riktiga datum', () => {
    expect(isISODate('2026-11-17')).toBe(true);
    expect(isISODate('2028-02-29')).toBe(true);
  });
  it('nekar fel format och omöjliga datum', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('17/11/2026')).toBe(false);
    expect(isISODate('')).toBe(false);
  });
});

describe('field', () => {
  it('trimmar och ger tom sträng när fältet saknas', () => {
    const fd = new FormData();
    fd.set('a', '  hej ');
    expect(field(fd, 'a')).toBe('hej');
    expect(field(fd, 'b')).toBe('');
  });
});
