import { describe, expect, it } from 'vitest';
import { buildMonthStats, parseMonth, shiftMonth } from './stats';
import type { LogEntry } from '../types';

function log(p: Partial<LogEntry>): LogEntry {
  return {
    id: 'l', playerId: 'p1', date: '2026-11-17', type: 'training',
    eventUid: null, otherKind: null, missionId: null, km: null, ...p,
  };
}

describe('buildMonthStats', () => {
  it("'2026-11' ger 30 dagar i ordning", () => {
    const s = buildMonthStats([], '2026-11', '2026-11-17');
    expect(s.days).toHaveLength(30);
    expect(s.days[0].date).toBe('2026-11-01');
    expect(s.days[29].date).toBe('2026-11-30');
  });

  it('februari 2028 (skottår) ger 29 dagar', () => {
    expect(buildMonthStats([], '2028-02', '2028-02-10').days).toHaveLength(29);
  });

  it('aktiva dagar markeras', () => {
    const s = buildMonthStats([log({ date: '2026-11-10' })], '2026-11', '2026-11-17');
    expect(s.days.find((d) => d.date === '2026-11-10')).toEqual({ date: '2026-11-10', active: true, frozen: false });
    expect(s.days.find((d) => d.date === '2026-11-11')?.active).toBe(false);
  });

  it('en frusen dag ger frozen: true och active: false', () => {
    // mån 16 aktiv, tis 17 missad (frusen), ons 18 aktiv
    const s = buildMonthStats(
      [log({ id: 'a', date: '2026-11-16' }), log({ id: 'b', date: '2026-11-18' })],
      '2026-11',
      '2026-11-20',
    );
    expect(s.days.find((d) => d.date === '2026-11-17')).toEqual({ date: '2026-11-17', active: false, frozen: true });
  });

  it('frusna dagar i en avslutad streak tidigare i historiken visas också', () => {
    // v45: mån 2 aktiv, tis 3 frusen, ons 4 aktiv. Sedan inget på länge.
    const s = buildMonthStats(
      [log({ id: 'a', date: '2026-11-02' }), log({ id: 'b', date: '2026-11-04' })],
      '2026-11',
      '2026-11-20',
    );
    expect(s.days.find((d) => d.date === '2026-11-03')?.frozen).toBe(true);
    expect(s.days.filter((d) => d.frozen)).toHaveLength(1);
  });

  it('dagar efter idag är varken aktiva eller frusna', () => {
    const s = buildMonthStats([log({ date: '2026-11-16' })], '2026-11', '2026-11-17');
    expect(s.days.filter((d) => d.date > '2026-11-17').every((d) => !d.active && !d.frozen)).toBe(true);
  });

  it('countsByType.match räknar matcher', () => {
    const s = buildMonthStats(
      [
        log({ id: 'm1', date: '2026-11-07', type: 'match', eventUid: 'e1' }),
        log({ id: 'm2', date: '2026-11-07', type: 'match', eventUid: 'e2' }),
        log({ id: 'm3', date: '2026-11-14', type: 'match', eventUid: 'e3' }),
        log({ id: 't1', date: '2026-11-10', type: 'training', eventUid: 'e4' }),
      ],
      '2026-11',
      '2026-11-17',
    );
    expect(s.countsByType).toEqual({ training: 1, match: 3, other_org: 0, extra: 0, weekly: 0 });
  });

  it('räknar bara pass i vald månad', () => {
    const s = buildMonthStats(
      [log({ id: 'a', date: '2026-10-31', type: 'match' }), log({ id: 'b', date: '2026-12-01', type: 'match' })],
      '2026-11',
      '2026-12-02',
    );
    expect(s.countsByType.match).toBe(0);
  });

  it('totalKm summerar månadens km', () => {
    const s = buildMonthStats(
      [
        log({ id: 'w1', date: '2026-11-07', type: 'weekly', missionId: 'w', km: 4.5 }),
        log({ id: 'w2', date: '2026-11-08', type: 'weekly', missionId: 'w', km: 3.7 }),
        log({ id: 'w3', date: '2026-10-25', type: 'weekly', missionId: 'w', km: 10 }),
        log({ id: 't', date: '2026-11-09' }),
      ],
      '2026-11',
      '2026-11-17',
    );
    expect(s.totalKm).toBeCloseTo(8.2);
  });

  it('longestStreak gäller hela historiken, inte bara månaden', () => {
    const s = buildMonthStats(
      [
        log({ id: 'a', date: '2026-10-05' }),
        log({ id: 'b', date: '2026-10-06' }),
        log({ id: 'c', date: '2026-10-07' }),
        log({ id: 'd', date: '2026-11-10' }),
      ],
      '2026-11',
      '2026-11-17',
    );
    expect(s.longestStreak).toBe(3);
  });

  it('inga loggar ger nollor', () => {
    const s = buildMonthStats([], '2026-11', '2026-11-17');
    expect(s.longestStreak).toBe(0);
    expect(s.totalKm).toBe(0);
    expect(Object.values(s.countsByType).every((n) => n === 0)).toBe(true);
    expect(s.days.every((d) => !d.active && !d.frozen)).toBe(true);
  });
});

describe('parseMonth', () => {
  it('giltig månad behålls', () => {
    expect(parseMonth('2026-10', '2026-11-17')).toBe('2026-10');
  });
  it('saknad, ogiltig eller framtida månad ger idag', () => {
    expect(parseMonth(undefined, '2026-11-17')).toBe('2026-11');
    expect(parseMonth('2026-13', '2026-11-17')).toBe('2026-11');
    expect(parseMonth(['2026-10'], '2026-11-17')).toBe('2026-11');
    expect(parseMonth('2026-12', '2026-11-17')).toBe('2026-11');
  });
});

describe('shiftMonth', () => {
  it('flyttar över årsskiftet', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-11', -1)).toBe('2026-10');
  });
});
