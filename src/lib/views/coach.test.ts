import { describe, expect, it } from 'vitest';
import { buildCoachOverview, sortCoachOverview } from './coach';
import type { LogEntry } from '../types';

function log(date: string, p: Partial<LogEntry> = {}): LogEntry {
  return {
    id: date, playerId: 'p1', date, type: 'training',
    eventUid: null, otherKind: null, missionId: null, km: null, ...p,
  };
}

const TODAY = '2026-11-17';

describe('buildCoachOverview', () => {
  it('räknar active7 som aktiva dagar i today − 6 .. today', () => {
    const [row] = buildCoachOverview(
      [
        {
          id: 'p1',
          name: 'Elias',
          logs: [
            log('2026-11-10'), // today − 7: utanför
            log('2026-11-11'), // today − 6: innanför
            log('2026-11-14'),
            log('2026-11-14', { id: 'x', type: 'extra' }), // samma dag räknas en gång
            log('2026-11-17'),
            log('2026-11-18'), // framtid: utanför
          ],
        },
      ],
      TODAY,
    );
    expect(row.active7).toBe(3);
  });

  it('räknar active30 som aktiva dagar i today − 29 .. today', () => {
    const [row] = buildCoachOverview(
      [{ id: 'p1', name: 'Elias', logs: [log('2026-10-18'), log('2026-10-19'), log('2026-11-01')] }],
      TODAY,
    );
    // 2026-10-19 = today − 29
    expect(row.active30).toBe(2);
  });

  it('activeToday och dayStreak', () => {
    const [row] = buildCoachOverview(
      [{ id: 'p1', name: 'Elias', logs: [log('2026-11-15'), log('2026-11-16'), log('2026-11-17')] }],
      TODAY,
    );
    expect(row).toEqual({ id: 'p1', name: 'Elias', activeToday: true, dayStreak: 3, active7: 3, active30: 3 });
  });

  it('en spelare utan loggar ger nollor och inte ett fel', () => {
    expect(buildCoachOverview([{ id: 'p2', name: 'Alva', logs: [] }], TODAY)).toEqual([
      { id: 'p2', name: 'Alva', activeToday: false, dayStreak: 0, active7: 0, active30: 0 },
    ]);
  });

  it('behåller ordningen från indata', () => {
    const rows = buildCoachOverview(
      [
        { id: 'b', name: 'Bo', logs: [] },
        { id: 'a', name: 'Ali', logs: [] },
      ],
      TODAY,
    );
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('sortCoachOverview', () => {
  const rows = [
    { id: '1', name: 'Örjan', activeToday: false, dayStreak: 2, active7: 5, active30: 9 },
    { id: '2', name: 'Alva', activeToday: true, dayStreak: 9, active7: 2, active30: 20 },
    { id: '3', name: 'Elias', activeToday: true, dayStreak: 2, active7: 7, active30: 1 },
  ];

  it('sorterar på namn med svensk ordning (Ö sist)', () => {
    expect(sortCoachOverview(rows, 'name', 'asc').map((r) => r.name)).toEqual(['Alva', 'Elias', 'Örjan']);
  });

  it('sorterar på streak fallande, lika sorteras på namn', () => {
    expect(sortCoachOverview(rows, 'streak', 'desc').map((r) => r.name)).toEqual(['Alva', 'Elias', 'Örjan']);
  });

  it('sorterar på active7 stigande', () => {
    expect(sortCoachOverview(rows, 'active7', 'asc').map((r) => r.id)).toEqual(['2', '1', '3']);
  });

  it('sorterar på idag (aktiva först vid desc)', () => {
    expect(sortCoachOverview(rows, 'today', 'desc').map((r) => r.id)).toEqual(['2', '3', '1']);
  });

  it('ändrar inte indata', () => {
    const copy = [...rows];
    sortCoachOverview(rows, 'active30', 'desc');
    expect(rows).toEqual(copy);
  });
});
