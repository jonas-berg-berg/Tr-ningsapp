import { describe, expect, it } from 'vitest';
import { unauthenticatedAccess } from './route-access';

describe('unauthenticatedAccess', () => {
  it('publika sidor och cron släpps igenom', () => {
    expect(unauthenticatedAccess('/login')).toBe('allow');
    expect(unauthenticatedAccess('/invite/abc')).toBe('allow');
    expect(unauthenticatedAccess('/api/cron/reminders')).toBe('allow');
  });
  it('övriga API-anrop får 401 JSON i stället för omdirigering', () => {
    expect(unauthenticatedAccess('/api/push/subscribe')).toBe('unauthorized');
    expect(unauthenticatedAccess('/api')).toBe('unauthorized');
  });
  it('sidor skickas till inloggningen', () => {
    expect(unauthenticatedAccess('/')).toBe('redirect');
    expect(unauthenticatedAccess('/tranare')).toBe('redirect');
    expect(unauthenticatedAccess('/apix')).toBe('redirect');
  });
});
