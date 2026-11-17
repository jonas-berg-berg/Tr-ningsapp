import { describe, expect, it } from 'vitest';
import { INVITE_VALID_DAYS, inviteCutoff, isInviteExpired } from './invites';

describe('inbjudningars giltighet', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  it('gäller i 7 dagar', () => {
    expect(INVITE_VALID_DAYS).toBe(7);
    expect(inviteCutoff(now)).toBe('2026-11-10T12:00:00.000Z');
  });
  it('precis 7 dagar gammal är fortfarande giltig, äldre har gått ut', () => {
    expect(isInviteExpired('2026-11-10T12:00:00Z', now)).toBe(false);
    expect(isInviteExpired('2026-11-10T11:59:59Z', now)).toBe(true);
    expect(isInviteExpired('2026-11-17T08:00:00Z', now)).toBe(false);
  });
  it('ogiltigt datum räknas som utgånget', () => {
    expect(isInviteExpired('trams', now)).toBe(true);
  });
});
