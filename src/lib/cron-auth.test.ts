import { describe, expect, it } from 'vitest';
import { isAuthorizedCron } from './cron-auth';

const req = (auth?: string) =>
  new Request('http://x', auth ? { headers: { authorization: auth } } : undefined);

describe('isAuthorizedCron', () => {
  it('godkänner rätt hemlighet', () => expect(isAuthorizedCron(req('Bearer s'), 's')).toBe(true));
  it('nekar saknad header', () => expect(isAuthorizedCron(req(), 's')).toBe(false));
  it('nekar fel hemlighet', () => expect(isAuthorizedCron(req('Bearer t'), 's')).toBe(false));
  it('nekar fel längd', () => expect(isAuthorizedCron(req('Bearer ss'), 's')).toBe(false));
  it('nekar utan Bearer-prefix', () => expect(isAuthorizedCron(req('s'), 's')).toBe(false));
  it('nekar alltid när hemligheten är tom', () => {
    expect(isAuthorizedCron(req('Bearer '), '')).toBe(false);
    expect(isAuthorizedCron(req(''), '')).toBe(false);
  });
});
