import { describe, expect, it } from 'vitest';
import { classifyEvent } from './classify';

describe('classifyEvent', () => {
  it('klassar träning', () => {
    expect(classifyEvent('Träning - P11/12')).toBe('training');
    expect(classifyEvent('  träning extra')).toBe('training');
  });
  it('klassar match', () => {
    expect(classifyEvent('Match: A - B (Serie)')).toBe('match');
  });
  it('övrigt blir other', () => {
    expect(classifyEvent('Fotografering  - P11/12')).toBe('other');
    expect(classifyEvent('Matchgenomgång')).toBe('other');
  });
});
