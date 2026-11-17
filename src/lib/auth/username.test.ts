import { describe, expect, it } from 'vitest';
import { normalizeUsername, usernameToEmail } from './username';

describe('normalizeUsername', () => {
  it('gör om till gemener och behåller tillåtna tecken', () => {
    expect(normalizeUsername('Elias_09')).toBe('elias_09');
    expect(normalizeUsername('  Leo.k-7 ')).toBe('leo.k-7');
  });

  it('gör å/ä/ö till a/a/o', () => {
    expect(normalizeUsername('Åke')).toBe('ake');
    expect(normalizeUsername('Björn')).toBe('bjorn');
    expect(normalizeUsername('Häll')).toBe('hall');
  });

  it('kräver 3–20 tecken', () => {
    expect(normalizeUsername('a')).toBeNull();
    expect(normalizeUsername('ab')).toBeNull();
    expect(normalizeUsername('abc')).toBe('abc');
    expect(normalizeUsername('a'.repeat(20))).toBe('a'.repeat(20));
    expect(normalizeUsername('a'.repeat(21))).toBeNull();
  });

  it('nekar otillåtna tecken', () => {
    expect(normalizeUsername('elias berg')).toBeNull();
    expect(normalizeUsername('elias@x')).toBeNull();
    expect(normalizeUsername('josé')).toBeNull();
    expect(normalizeUsername('')).toBeNull();
  });
});

describe('usernameToEmail', () => {
  it('bygger en intern e-postadress', () => {
    expect(usernameToEmail('elias_09')).toBe('elias_09@spelare.traningsappen.invalid');
  });
});
