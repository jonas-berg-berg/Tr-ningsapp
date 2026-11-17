import { describe, expect, it } from 'vitest';
import {
  activeDates, activeMission, canPlayerLog, completedWeeks, governingWeeklyMission, missionLoggableOn,
  weeklyAllowedOn, weeklyProgress, weeksWithoutMission,
} from './logging';
import { weekStreak } from './streaks';
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

  it('bara veckans styrande uppdrag (senast startade med loggbar dag) behöver vara klart', () => {
    const m2 = { ...weekly, id: 'm2', targetKm: null, activeFrom: '2026-11-18' };
    const logs = [log({ date: '2026-11-17', type: 'weekly', missionId: 'm1', km: 8 })];
    // m2 startar onsdag och styr veckan: m1-loggen räcker inte.
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

// Byte mitt i veckan: "8 km" (lör–sön) avslutas onsdag, "10 km" gäller från torsdag.
const old8: Mission = { ...weekly, id: 'old', targetKm: 8, weekdays: [6, 7], activeFrom: '2026-11-01', activeTo: '2026-11-18' };
const new10: Mission = { ...weekly, id: 'new', targetKm: 10, weekdays: [], activeFrom: '2026-11-19', activeTo: null };

describe('missionLoggableOn', () => {
  it('kräver aktivt datumintervall och tillåten veckodag', () => {
    expect(missionLoggableOn(old8, '2026-11-14')).toBe(true); // lör
    expect(missionLoggableOn(old8, '2026-11-18')).toBe(false); // ons, fel veckodag
    expect(missionLoggableOn(old8, '2026-11-21')).toBe(false); // lör, efter slutdatum
    expect(missionLoggableOn(new10, '2026-11-19')).toBe(true);
    expect(missionLoggableOn(new10, '2026-11-18')).toBe(false); // före start
  });
});

describe('governingWeeklyMission', () => {
  it('väljer senast startade uppdraget som har en loggbar dag i veckan', () => {
    expect(governingWeeklyMission([old8, new10], '2026-W47')?.id).toBe('new');
    expect(governingWeeklyMission([old8, new10], '2026-W46')?.id).toBe('old');
  });
  it('ett uppdrag utan loggbar dag i veckan styr inte', () => {
    // old8 är aktivt mån–ons v47 men gäller bara lör–sön.
    expect(governingWeeklyMission([old8], '2026-W47')).toBeNull();
  });
  it('daily ignoreras; ingen mission ger null', () => {
    expect(governingWeeklyMission([{ ...weekly, kind: 'daily' }], '2026-W47')).toBeNull();
    expect(governingWeeklyMission([], '2026-W47')).toBeNull();
  });
});

describe('activeMission', () => {
  it('senast startade aktiva uppdraget av en sort', () => {
    expect(activeMission([old8, new10], 'weekly', '2026-11-18')?.id).toBe('old');
    expect(activeMission([old8, new10], 'weekly', '2026-11-19')?.id).toBe('new');
    expect(activeMission([old8, new10], 'daily', '2026-11-19')).toBeNull();
  });
});

describe('weeklyProgress', () => {
  it('summerar uppdragets km i veckan', () => {
    const logs = [
      log({ id: 'a', date: '2026-11-19', type: 'weekly', missionId: 'new', km: 6 }),
      log({ id: 'b', date: '2026-11-22', type: 'weekly', missionId: 'new', km: 4 }),
      log({ id: 'c', date: '2026-11-15', type: 'weekly', missionId: 'new', km: 9 }),
    ];
    expect(weeklyProgress(logs, new10, '2026-W47')).toEqual({ doneKm: 10, complete: true });
    expect(weeklyProgress(logs.slice(0, 1), new10, '2026-W47')).toEqual({ doneKm: 6, complete: false });
  });
});

describe('weeksWithoutMission', () => {
  it('veckor utan styrande uppdrag från första uppdragets vecka till idag', () => {
    const a = { ...weekly, id: 'a', activeFrom: '2026-11-02', activeTo: '2026-11-08' }; // v45
    const b = { ...weekly, id: 'b', activeFrom: '2026-11-16', activeTo: null }; // från v47
    expect([...weeksWithoutMission([a, b], '2026-11-22')].sort()).toEqual(['2026-W46']);
    expect(weeksWithoutMission([], '2026-11-22').size).toBe(0);
  });
});

describe('byte av veckouppdrag mitt i veckan', () => {
  const logs = [
    log({ id: 'w46', date: '2026-11-14', type: 'weekly', missionId: 'old', km: 8 }),
    log({ id: 'w47a', date: '2026-11-21', type: 'weekly', missionId: 'new', km: 6 }),
    log({ id: 'w47b', date: '2026-11-22', type: 'weekly', missionId: 'new', km: 4 }),
  ];
  it('den nya veckan räknas klar och streaken håller', () => {
    const missions = [old8, new10];
    const done = completedWeeks(logs, missions);
    expect(done.has('2026-W46')).toBe(true);
    expect(done.has('2026-W47')).toBe(true);
    expect(weekStreak(done, '2026-11-22', weeksWithoutMission(missions, '2026-11-22'))).toBe(2);
  });
});

describe('vecka utan uppdrag hoppas över', () => {
  it('varken räknas eller bryter veckostreaken', () => {
    const a = { ...weekly, id: 'a', activeFrom: '2026-11-02', activeTo: '2026-11-08' }; // v45
    const b = { ...weekly, id: 'b', activeFrom: '2026-11-16', activeTo: null }; // från v47
    const missions = [a, b];
    const logs = [
      log({ id: '1', date: '2026-11-07', type: 'weekly', missionId: 'a', km: 8 }),
      log({ id: '2', date: '2026-11-21', type: 'weekly', missionId: 'b', km: 8 }),
    ];
    const done = completedWeeks(logs, missions);
    expect(weekStreak(done, '2026-11-22', weeksWithoutMission(missions, '2026-11-22'))).toBe(2);
    // Utan hoppa-över-mängden bryter v46.
    expect(weekStreak(done, '2026-11-22')).toBe(1);
  });
});

describe('uppdrag som avslutas i efterhand', () => {
  it('en vecka som var klar räknas fortfarande när slutdatumet flyttas före loggen', () => {
    const m = { ...weekly, weekdays: [], activeTo: '2026-11-19' }; // avslutad tor v47 i efterhand
    const logs = [log({ date: '2026-11-21', type: 'weekly', missionId: 'm1', km: 8 })];
    expect(completedWeeks(logs, [m]).has('2026-W47')).toBe(true);
  });
  it('en vecka där uppdraget inte längre har någon loggbar dag hoppas över, streaken bryts inte', () => {
    // lör–sön-uppdrag avslutat onsdag v46 i efterhand, nytt uppdrag från v47.
    const ended = { ...weekly, id: 'e', weekdays: [6, 7], activeFrom: '2026-11-02', activeTo: '2026-11-11' };
    const next = { ...weekly, id: 'n', weekdays: [6, 7], activeFrom: '2026-11-16', activeTo: null };
    const missions = [ended, next];
    const logs = [
      log({ id: '1', date: '2026-11-07', type: 'weekly', missionId: 'e', km: 8 }), // v45
      log({ id: '2', date: '2026-11-14', type: 'weekly', missionId: 'e', km: 8 }), // v46, nu utan loggbar dag
      log({ id: '3', date: '2026-11-21', type: 'weekly', missionId: 'n', km: 8 }), // v47
    ];
    const done = completedWeeks(logs, missions);
    expect(done.has('2026-W46')).toBe(false);
    expect(weekStreak(done, '2026-11-22', weeksWithoutMission(missions, '2026-11-22'))).toBe(2);
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
