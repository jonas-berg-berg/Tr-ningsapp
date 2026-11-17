import { describe, expect, it } from 'vitest';
import { originFrom } from './origin';

describe('originFrom', () => {
  it('använder x-forwarded-proto och host', () => {
    expect(originFrom('traning.example.se', 'https')).toBe('https://traning.example.se');
  });
  it('tar första värdet om proxyn lagt flera', () => {
    expect(originFrom('a.se', 'https,http')).toBe('https://a.se');
  });
  it('utan proto: http för localhost, annars https', () => {
    expect(originFrom('localhost:3000', null)).toBe('http://localhost:3000');
    expect(originFrom('a.se', null)).toBe('https://a.se');
  });
  it('utan host: null', () => {
    expect(originFrom(null, 'https')).toBeNull();
  });
});
