import { describe, expect, it } from 'vitest';
import { remindersDue } from './reminders';
import type { LogEntry, Mission } from './types';

function log(p: Partial<LogEntry>): LogEntry {
  return {
    id: 'l', playerId: 'p1', date: '2026-11-18', type: 'training',
    eventUid: null, otherKind: null, missionId: null, km: null, ...p,
  };
}
const weekly: Mission = {
  id: 'm1', kind: 'weekly', name: 'Löprunda', description: null, targetKm: 8,
  weekdays: [], activeFrom: '2026-11-01', activeTo: null,
};

describe('remindersDue daily', () => {
  const now = new Date('2026-11-18T18:00:00Z'); // 19:00 lokal
  it('spelare utan logg idag får daily, med streak', () => {
    const players = [
      { id: 'a', logs: [log({ date: '2026-11-17' }), log({ date: '2026-11-16' })] },
      { id: 'b', logs: [log({ date: '2026-11-18' })] },
    ];
    expect(remindersDue(now, players, [])).toEqual([{ playerId: 'a', kind: 'daily', streak: 2 }]);
  });
  it('fel timme ger tomt', () => {
    expect(remindersDue(new Date('2026-11-18T17:00:00Z'), [{ id: 'a', logs: [] }], [])).toEqual([]);
  });
});

describe('remindersDue weekly', () => {
  const now = new Date('2026-11-22T14:00:00Z'); // sön 15:00 lokal
  it('ej klar vecka med aktiv mission ger weekly', () => {
    const players = [{ id: 'a', logs: [log({ type: 'weekly', missionId: 'm1', km: 3, date: '2026-11-21' })] }];
    expect(remindersDue(now, players, [weekly])).toEqual([{ playerId: 'a', kind: 'weekly', streak: 0 }]);
  });
  it('klar vecka ger inget; streak räknas för andra', () => {
    const players = [
      { id: 'done', logs: [log({ type: 'weekly', missionId: 'm1', km: 8, date: '2026-11-21' })] },
      { id: 'prev', logs: [log({ type: 'weekly', missionId: 'm1', km: 9, date: '2026-11-15' })] },
    ];
    expect(remindersDue(now, players, [weekly])).toEqual([{ playerId: 'prev', kind: 'weekly', streak: 1 }]);
  });
  it('ingen aktiv weekly-mission ger inget', () => {
    expect(remindersDue(now, [{ id: 'a', logs: [] }], [])).toEqual([]);
    const ended = { ...weekly, activeTo: '2026-11-20' };
    expect(remindersDue(now, [{ id: 'a', logs: [] }], [ended])).toEqual([]);
  });
  it('fel veckodag ger inget', () => {
    expect(remindersDue(new Date('2026-11-21T14:00:00Z'), [{ id: 'a', logs: [] }], [weekly])).toEqual([]);
  });
});
