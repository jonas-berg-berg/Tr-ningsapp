import { describe, expect, it } from 'vitest';
import { buildTodayView, type TodayInput } from './today';
import type { CalendarEvent, LogEntry, Mission, TeamGoal } from '../types';

function ev(p: Partial<CalendarEvent>): CalendarEvent {
  return {
    uid: 'e', summary: 'Träning P11/12', startsAt: new Date('2026-11-17T17:00:00Z'),
    endsAt: new Date('2026-11-17T18:30:00Z'), location: null, description: null,
    kind: 'training', date: '2026-11-17', cancelled: false, ...p,
  };
}

function log(p: Partial<LogEntry>): LogEntry {
  return {
    id: 'l', playerId: 'p1', date: '2026-11-17', type: 'training',
    eventUid: null, otherKind: null, missionId: null, km: null, ...p,
  };
}

const daily: Mission = {
  id: 'd1', kind: 'daily', name: 'Splits 3×10', description: 'Bulgarian splits 3×10 per ben',
  targetKm: null, weekdays: [], activeFrom: '2026-11-01', activeTo: null,
};

const weekly: Mission = {
  id: 'w1', kind: 'weekly', name: 'Löpning 8 km', description: null,
  targetKm: 8, weekdays: [6, 7], activeFrom: '2026-11-01', activeTo: null,
};

function input(p: Partial<TodayInput>): TodayInput {
  return { today: '2026-11-17', events: [], logs: [], missions: [], goals: [], goalTotals: {}, ...p };
}

// Två matcher och en fotografering lördag 2026-12-06 (svensk vintertid, UTC+1).
const matchLate = ev({
  uid: 'm-late', summary: 'Match: Lerums IS - IBK Göteborg', kind: 'match', date: '2026-12-06',
  startsAt: new Date('2026-12-06T15:10:00Z'), endsAt: new Date('2026-12-06T16:10:00Z'),
});
const matchEarly = ev({
  uid: 'm-early', summary: 'Match: Lerums IS - Partille IBS', kind: 'match', date: '2026-12-06',
  startsAt: new Date('2026-12-06T11:00:00Z'), endsAt: new Date('2026-12-06T12:00:00Z'),
});
const photo = ev({
  uid: 'photo', summary: 'Fotografering  - P11/12', kind: 'other', date: '2026-12-06',
  startsAt: new Date('2026-12-06T09:00:00Z'), endsAt: new Date('2026-12-06T10:00:00Z'),
});

describe('buildTodayView – händelser', () => {
  it('visar två matcher men inte fotograferingen, sorterade på tid', () => {
    const view = buildTodayView(input({ today: '2026-12-06', events: [matchLate, photo, matchEarly] }));
    expect(view.events).toHaveLength(2);
    expect(view.events.map((e) => e.time)).toEqual(['12:00', '16:10']);
    expect(view.events.map((e) => e.kind)).toEqual(['match', 'match']);
    expect(view.events[0]).toMatchObject({ uid: 'm-early', title: 'Match: Lerums IS - Partille IBS' });
  });

  it('en kryssad match ger checked bara på den matchen', () => {
    const view = buildTodayView(input({
      today: '2026-12-06',
      events: [matchLate, photo, matchEarly],
      logs: [log({ date: '2026-12-06', type: 'match', eventUid: 'm-late' })],
    }));
    const byUid = Object.fromEntries(view.events.map((e) => [e.uid, e.checked]));
    expect(byUid).toEqual({ 'm-early': false, 'm-late': true });
  });

  it('visar inte en inställd händelse', () => {
    const view = buildTodayView(input({ events: [ev({ uid: 'x', cancelled: true })] }));
    expect(view.events).toEqual([]);
  });

  it('visar en fotografering som vyn levererar som training (kind_override) – klassar aldrig om på summary', () => {
    const view = buildTodayView(input({
      today: '2026-12-06',
      events: [ev({ ...photo, kind: 'training' })],
    }));
    expect(view.events).toEqual([
      { uid: 'photo', kind: 'training', title: 'Fotografering  - P11/12', time: '10:00', checked: false, logId: null },
    ]);
  });

  it('visar bara händelser för vyns datum', () => {
    const view = buildTodayView(input({ events: [ev({ uid: 'a' }), ev({ uid: 'b', date: '2026-11-18' })] }));
    expect(view.events.map((e) => e.uid)).toEqual(['a']);
  });
});

describe('buildTodayView – extrapass', () => {
  it('är framhävt utan organiserad logg och inte med en training-logg', () => {
    const without = buildTodayView(input({ missions: [daily] }));
    expect(without.extras).toHaveLength(1);
    expect(without.extras[0]).toMatchObject({ missionId: 'd1', name: 'Splits 3×10', checked: false, emphasized: true });

    const withTraining = buildTodayView(input({
      missions: [daily],
      events: [ev({ uid: 't1' })],
      logs: [log({ type: 'training', eventUid: 't1' })],
    }));
    expect(withTraining.extras[0].emphasized).toBe(false);
  });

  it('annan organiserad träning tar också bort framhävningen och syns i otherOrg', () => {
    const view = buildTodayView(input({
      missions: [daily],
      logs: [log({ type: 'other_org', otherKind: 'fotboll' })],
    }));
    expect(view.extras[0].emphasized).toBe(false);
    expect(view.otherOrg).toMatchObject({ checked: true, kind: 'fotboll' });
  });

  it('checked när extrapasset är loggat idag', () => {
    const view = buildTodayView(input({ missions: [daily], logs: [log({ type: 'extra', missionId: 'd1' })] }));
    expect(view.extras[0].checked).toBe(true);
  });

  it('är tom utan aktivt dagligt uppdrag', () => {
    expect(buildTodayView(input({})).extras).toEqual([]);
    expect(buildTodayView(input({ missions: [{ ...daily, activeTo: '2026-11-16' }] })).extras).toEqual([]);
    expect(buildTodayView(input({ missions: [{ ...daily, activeFrom: '2026-11-18' }] })).extras).toEqual([]);
  });

  const mini: Mission = { ...daily, id: 'd2', name: 'Minipass', activeFrom: '2026-11-10' };

  it('visar alla aktiva dagsuppdrag att välja mellan, senast startade först', () => {
    const view = buildTodayView(input({ missions: [daily, mini] }));
    expect(view.extras.map((x) => [x.missionId, x.checked])).toEqual([['d2', false], ['d1', false]]);
  });

  it('alla extrapass syns kvar när ett är ikryssat', () => {
    const view = buildTodayView(input({ missions: [daily, mini], logs: [log({ id: 'L9', type: 'extra', missionId: 'd1' })] }));
    expect(view.extras.map((x) => [x.missionId, x.checked, x.logId])).toEqual([['d2', false, null], ['d1', true, 'L9']]);
  });

  it('flera extrapass kan vara ikryssade samma dag', () => {
    const view = buildTodayView(input({
      missions: [daily, mini],
      logs: [log({ id: 'L8', type: 'extra', missionId: 'd2' }), log({ id: 'L9', type: 'extra', missionId: 'd1' })],
    }));
    expect(view.extras.map((x) => [x.missionId, x.checked, x.logId])).toEqual([['d2', true, 'L8'], ['d1', true, 'L9']]);
  });

  it('visar dagens loggade extrapass även om uppdraget har slutat', () => {
    const ended = { ...mini, activeTo: '2026-11-16' };
    const view = buildTodayView(input({ missions: [daily, ended], logs: [log({ type: 'extra', missionId: 'd2' })] }));
    expect(view.extras.map((x) => [x.missionId, x.checked])).toEqual([['d1', false], ['d2', true]]);
  });
});

describe('buildTodayView – veckouppdrag', () => {
  it('availableToday är true på lördag och false på onsdag när weekdays är [6,7]', () => {
    expect(buildTodayView(input({ today: '2026-11-21', missions: [weekly] })).weekly?.availableToday).toBe(true);
    expect(buildTodayView(input({ today: '2026-11-18', missions: [weekly] })).weekly?.availableToday).toBe(false);
  });

  it('summerar veckans km och blir complete vid målet', () => {
    const logs = [
      log({ id: 'a', date: '2026-11-21', type: 'weekly', missionId: 'w1', km: 3.5 }),
      log({ id: 'b', date: '2026-11-14', type: 'weekly', missionId: 'w1', km: 10 }), // förra veckan
    ];
    const half = buildTodayView(input({ today: '2026-11-22', missions: [weekly], logs }));
    expect(half.weekly).toMatchObject({ missionId: 'w1', targetKm: 8, doneKm: 3.5, complete: false });

    const full = buildTodayView(input({
      today: '2026-11-22', missions: [weekly],
      logs: [...logs, log({ id: 'c', date: '2026-11-22', type: 'weekly', missionId: 'w1', km: 4.5 })],
    }));
    expect(full.weekly).toMatchObject({ doneKm: 8, complete: true });
  });

  it('byte mitt i veckan: vyn visar veckans styrande uppdrag och stämmer med veckostreaken', () => {
    const old8: Mission = { ...weekly, id: 'old', activeTo: '2026-11-18' }; // lör–sön, avslutas ons
    const new10: Mission = { ...weekly, id: 'new', targetKm: 10, weekdays: [], activeFrom: '2026-11-19' };
    const missions = [old8, new10];
    const prev = log({ id: 'p', date: '2026-11-14', type: 'weekly', missionId: 'old', km: 8 });
    // Onsdag: det gamla uppdraget kan inte längre loggas, det nya visas men gäller från torsdag.
    const wed = buildTodayView(input({ today: '2026-11-18', missions, logs: [prev] }));
    expect(wed.weekly).toMatchObject({ missionId: 'new', availableToday: false, complete: false });
    expect(wed.weekStreak).toBe(1);

    const logs = [
      prev,
      log({ id: 'a', date: '2026-11-21', type: 'weekly', missionId: 'new', km: 6 }),
      log({ id: 'b', date: '2026-11-22', type: 'weekly', missionId: 'new', km: 4 }),
    ];
    const sun = buildTodayView(input({ today: '2026-11-22', missions, logs }));
    expect(sun.weekly).toMatchObject({ missionId: 'new', doneKm: 10, complete: true, availableToday: true });
    expect(sun.weekStreak).toBe(2);
  });

  it('vecka utan veckouppdrag bryter inte veckostreaken', () => {
    const a: Mission = { ...weekly, id: 'a', activeTo: '2026-11-08' };
    const b: Mission = { ...weekly, id: 'b', activeFrom: '2026-11-16' };
    const view = buildTodayView(input({
      today: '2026-11-22',
      missions: [a, b],
      logs: [
        log({ id: '1', date: '2026-11-07', type: 'weekly', missionId: 'a', km: 8 }),
        log({ id: '2', date: '2026-11-21', type: 'weekly', missionId: 'b', km: 8 }),
      ],
    }));
    expect(view.weekStreak).toBe(2);
  });

  it('är null utan aktivt veckouppdrag', () => {
    expect(buildTodayView(input({ missions: [daily] })).weekly).toBeNull();
  });
});

describe('buildTodayView – streaks, lagmål och igår', () => {
  it('räknar dag- och veckostreak', () => {
    const view = buildTodayView(input({
      today: '2026-11-22',
      missions: [weekly],
      logs: [
        log({ id: '1', date: '2026-11-20', type: 'other_org', otherKind: 'ovrigt' }),
        log({ id: '2', date: '2026-11-21', type: 'weekly', missionId: 'w1', km: 8 }),
        log({ id: '3', date: '2026-11-22', type: 'weekly', missionId: 'w1', km: 1 }),
      ],
    }));
    expect(view.dayStreak).toBe(3);
    expect(view.weekStreak).toBe(1);
    expect(view.frozenThisWeek).toBe(false);
  });

  it('frozenThisWeek när en frysdag använts denna vecka', () => {
    const view = buildTodayView(input({
      today: '2026-11-19',
      logs: [
        log({ id: '1', date: '2026-11-17', type: 'other_org', otherKind: 'ovrigt' }),
        log({ id: '2', date: '2026-11-19', type: 'other_org', otherKind: 'ovrigt' }),
      ],
    }));
    expect(view.dayStreak).toBe(2);
    expect(view.frozenThisWeek).toBe(true);
  });

  it('visar bara pågående lagmål med summa från goalTotals', () => {
    const goal: TeamGoal = {
      id: 'g1', name: '200 pass före jul', metric: 'sessions', target: 200,
      startsOn: '2026-11-01', endsOn: '2026-12-20', reward: 'Pizza!',
    };
    const old: TeamGoal = { ...goal, id: 'g0', endsOn: '2026-11-10' };
    const view = buildTodayView(input({ goals: [goal, old], goalTotals: { g1: 132 } }));
    expect(view.goals).toEqual([
      {
        id: 'g1', name: '200 pass före jul', metric: 'sessions', total: 132, target: 200, reward: 'Pizza!',
        startsOn: '2026-11-01', endsOn: '2026-12-20',
      },
    ]);
  });

  it('canLogYesterday är true i idag-läget och false när vyn redan visar igår', () => {
    expect(buildTodayView(input({})).canLogYesterday).toBe(true);
    const y = buildTodayView(input({ today: '2026-11-16', now: '2026-11-17' }));
    expect(y.date).toBe('2026-11-16');
    expect(y.canLogYesterday).toBe(false);
  });

  it('streaks räknas från riktiga idag även i igår-läget', () => {
    const logs = [
      log({ id: '1', date: '2026-11-16', type: 'other_org', otherKind: 'ovrigt' }),
      log({ id: '2', date: '2026-11-17', type: 'other_org', otherKind: 'ovrigt' }),
    ];
    expect(buildTodayView(input({ today: '2026-11-16', now: '2026-11-17', logs })).dayStreak).toBe(2);
  });
});

describe('buildTodayView – logg-id för ångra', () => {
  it('ger id på dagens loggar så att de kan ångras', () => {
    const view = buildTodayView(input({
      today: '2026-11-21',
      missions: [daily, weekly],
      events: [ev({ uid: 't1', date: '2026-11-21' })],
      logs: [
        log({ id: 'L1', date: '2026-11-21', type: 'training', eventUid: 't1' }),
        log({ id: 'L2', date: '2026-11-21', type: 'other_org', otherKind: 'annat_lag' }),
        log({ id: 'L3', date: '2026-11-21', type: 'extra', missionId: 'd1' }),
        log({ id: 'L4', date: '2026-11-21', type: 'weekly', missionId: 'w1', km: 4 }),
      ],
    }));
    expect(view.events[0].logId).toBe('L1');
    expect(view.otherOrg.logId).toBe('L2');
    expect(view.extras[0].logId).toBe('L3');
    expect(view.weekly?.todayLog).toEqual({ id: 'L4', km: 4 });
  });

  it('null när inget är loggat', () => {
    const view = buildTodayView(input({ missions: [daily, weekly], events: [ev({ uid: 't1' })] }));
    expect(view.events[0].logId).toBeNull();
    expect(view.otherOrg.logId).toBeNull();
    expect(view.extras.every((x) => x.logId === null)).toBe(true);
    expect(view.weekly?.todayLog).toBeNull();
  });
});
