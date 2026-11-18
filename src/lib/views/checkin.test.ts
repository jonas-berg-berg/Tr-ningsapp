import { describe, expect, it } from 'vitest';
import { nextCheckIn } from './checkin';

const ev = (uid: string, checked: boolean, kind: 'training' | 'match' = 'training') => ({
  uid, kind, title: 'Träning', time: '17:30', checked, logId: checked ? 'l' : null,
});
const extra = (checked: boolean, emphasized = true) => ({
  missionId: 'm', name: 'Teknik', description: null, checked, emphasized, logId: checked ? 'l' : null,
});
const other = (checked: boolean) => ({ checked, kind: null, logId: null });

describe('nextCheckIn', () => {
  it('tar första okryssade passet i kalendern', () => {
    expect(nextCheckIn({ events: [ev('a', true), ev('b', false, 'match')], extra: extra(false), otherOrg: other(false) }))
      .toEqual({ kind: 'event', uid: 'b', label: 'Match 17:30' });
  });
  it('tar dagens extrapass när kalendern är klar', () => {
    expect(nextCheckIn({ events: [ev('a', true)], extra: extra(false), otherOrg: other(false) }))
      .toEqual({ kind: 'extra', missionId: 'm', label: 'Extrapass: Teknik' });
  });
  it('hoppar över ett frivilligt extrapass och föreslår annan träning', () => {
    expect(nextCheckIn({ events: [], extra: extra(false, false), otherOrg: other(false) }))
      .toEqual({ kind: 'other', label: 'Annan träning' });
  });
  it('ger null när allt är incheckat', () => {
    expect(nextCheckIn({ events: [ev('a', true)], extra: extra(true), otherOrg: other(true) })).toBeNull();
  });
});
