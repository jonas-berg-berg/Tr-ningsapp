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
    expect(remindersDue(now, players, [])).toEqual([{ playerId: 'a', kind: 'daily', streak: 2, hasDailyMission: false }]);
  });
  it('hasDailyMission speglar om ett dagligt uppdrag är aktivt idag', () => {
    const daily: Mission = { ...weekly, id: 'd', kind: 'daily', targetKm: null };
    expect(remindersDue(now, [{ id: 'a', logs: [] }], [daily])).toEqual([
      { playerId: 'a', kind: 'daily', streak: 0, hasDailyMission: true },
    ]);
    const ended = { ...daily, activeTo: '2026-11-17' };
    expect(remindersDue(now, [{ id: 'a', logs: [] }], [ended])[0].hasDailyMission).toBe(false);
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
  it('uppdrag som inte gäller söndag ger ingen söndagspåminnelse', () => {
    const weekdaysOnly = { ...weekly, weekdays: [1, 2, 3, 4, 5] };
    expect(remindersDue(now, [{ id: 'a', logs: [] }], [weekdaysOnly])).toEqual([]);
  });
  it('byte mitt i veckan: klar med nya uppdraget ger ingen påminnelse, annars påminnelse', () => {
    const old8 = { ...weekly, id: 'old', weekdays: [6, 7], activeTo: '2026-11-18' };
    const new10 = { ...weekly, id: 'new', targetKm: 10, activeFrom: '2026-11-19' };
    const players = [
      { id: 'done', logs: [log({ type: 'weekly', missionId: 'new', km: 10, date: '2026-11-21' })] },
      { id: 'todo', logs: [log({ type: 'weekly', missionId: 'new', km: 4, date: '2026-11-21' })] },
    ];
    expect(remindersDue(now, players, [old8, new10])).toEqual([{ playerId: 'todo', kind: 'weekly', streak: 0 }]);
  });
  it('fel veckodag ger inget', () => {
    expect(remindersDue(new Date('2026-11-21T14:00:00Z'), [{ id: 'a', logs: [] }], [weekly])).toEqual([]);
  });
});
