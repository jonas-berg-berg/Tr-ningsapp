import { describe, expect, it } from 'vitest';
import { activeDates, canPlayerLog, completedWeeks, weeklyAllowedOn } from './logging';
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

describe('canPlayerLog', () => {
  it('tillåter idag och igår, inget annat', () => {
    expect(canPlayerLog('2026-11-18', '2026-11-18')).toBe(true);
    expect(canPlayerLog('2026-11-17', '2026-11-18')).toBe(true);
    expect(canPlayerLog('2026-11-16', '2026-11-18')).toBe(false);
    expect(canPlayerLog('2026-11-19', '2026-11-18')).toBe(false);
  });
});

describe('activeDates', () => {
  it('alla loggtyper, även weekly, gör dagen aktiv', () => {
    const set = activeDates([
      log({ date: '2026-11-10', type: 'training' }),
      log({ date: '2026-11-11', type: 'extra' }),
      log({ date: '2026-11-12', type: 'weekly', missionId: 'm1', km: 5 }),
    ]);
    expect([...set].sort()).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
  });
});

describe('completedWeeks', () => {
  it('summerar km över veckans weekly-loggar', () => {
    const weeks = completedWeeks(
      [
        log({ date: '2026-11-22', type: 'weekly', missionId: 'm1', km: 5 }),
        log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 4 }),
      ],
      [weekly],
    );
    expect(weeks.has('2026-W47')).toBe(true);
  });

  it('räknar veckan efter loggens datum, inte inläggningsdag', () => {
    const weeks = completedWeeks(
      [log({ date: '2026-11-22', type: 'weekly', missionId: 'm1', km: 9 })],
      [weekly],
    );
    expect(weeks.has('2026-W47')).toBe(true);
    expect(weeks.has('2026-W48')).toBe(false);
  });

  it('för lite km ger ej klar vecka', () => {
    const weeks = completedWeeks(
      [log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 7.9 })],
      [weekly],
    );
    expect(weeks.size).toBe(0);
  });

  it('targetKm null: en logg räcker', () => {
    const m = { ...weekly, targetKm: null };
    const weeks = completedWeeks([log({ date: '2026-11-21', type: 'weekly', missionId: 'm1' })], [m]);
    expect(weeks.has('2026-W47')).toBe(true);
  });

  it('alla aktiva weekly-missions måste vara klara', () => {
    const m2 = { ...weekly, id: 'm2', targetKm: null };
    const logs = [log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 8 })];
    expect(completedWeeks(logs, [weekly, m2]).size).toBe(0);
    logs.push(log({ id: 'b', date: '2026-11-20', type: 'weekly', missionId: 'm2' }));
    expect(completedWeeks(logs, [weekly, m2]).has('2026-W47')).toBe(true);
  });

  it('veckor utan aktiv weekly-mission tas inte med; daily ignoreras', () => {
    const early = { ...weekly, activeFrom: '2026-12-01' };
    const daily: Mission = { ...weekly, id: 'd', kind: 'daily' };
    const logs = [log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 9 })];
    expect(completedWeeks(logs, [early]).size).toBe(0);
    expect(completedWeeks(logs, [daily]).size).toBe(0);
  });

  it('mission avslutad före veckan räknas inte som aktiv', () => {
    const ended = { ...weekly, activeTo: '2026-11-15' };
    const logs = [log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 9 })];
    expect(completedWeeks(logs, [ended]).size).toBe(0);
  });
});

describe('weeklyAllowedOn', () => {
  it('tom lista betyder alla dagar', () => {
    expect(weeklyAllowedOn([], '2026-11-18')).toBe(true);
  });
  it('lör–sön: lördag och söndag tillåts, onsdag inte', () => {
    expect(weeklyAllowedOn([6, 7], '2026-11-21')).toBe(true);
    expect(weeklyAllowedOn([6, 7], '2026-11-22')).toBe(true);
    expect(weeklyAllowedOn([6, 7], '2026-11-18')).toBe(false);
  });
});
