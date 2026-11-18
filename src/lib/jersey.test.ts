import { describe, expect, it } from 'vitest';
import { parseJerseyNumber } from './jersey';

describe('parseJerseyNumber', () => {
  it('tomt fält tar bort numret', () => {
    expect(parseJerseyNumber('')).toBeNull();
    expect(parseJerseyNumber('  ')).toBeNull();
  });
  it('godtar heltal 0–99', () => {
    expect(parseJerseyNumber('0')).toBe(0);
    expect(parseJerseyNumber(' 17 ')).toBe(17);
    expect(parseJerseyNumber('99')).toBe(99);
  });
  it('underkänner allt annat', () => {
    for (const bad of ['100', '-1', '1.5', '7a', 'sju']) expect(parseJerseyNumber(bad)).toBeUndefined();
  });
});
