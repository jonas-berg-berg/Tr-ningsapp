import { addDays, isoWeekday, isoWeekKey } from '../dates';
import { activeDates, canPlayerLog, completedWeeks } from '../logging';
import { dayStreak, weekStreak } from '../streaks';
import type { CalendarEvent, ISODate, LogEntry, Mission, OtherOrgKind, TeamGoal } from '../types';

export interface TodayInput {
  /** Dagen vyn visar (idag, eller igår i igår-läget). */
  today: ISODate;
  /** Riktiga dagens datum (Stockholm). Standard: `today`. Styr streaks och canLogYesterday. */
  now?: ISODate;
  /** Från `calendar_events_effective`: `kind` är redan den effektiva typen. */
  events: CalendarEvent[];
  /** Spelarens egna loggar. */
  logs: LogEntry[];
  missions: Mission[];
  goals: TeamGoal[];
  /** Lagets summa per mål-id (från RPC `team_goal_total`). */
  goalTotals: Record<string, number>;
}

export interface TodayView {
  date: ISODate;
  dayStreak: number;
  weekStreak: number;
  frozenThisWeek: boolean;
  // logId: dagens logg (för ångra), annars null.
  events: { uid: string; kind: 'training' | 'match'; title: string; time: string; checked: boolean; logId: string | null }[];
  otherOrg: { checked: boolean; kind: OtherOrgKind | null; logId: string | null };
  extra: {
    missionId: string;
    name: string;
    description: string | null;
    checked: boolean;
    emphasized: boolean;
    logId: string | null;
  } | null;
  weekly: {
    missionId: string;
    name: string;
    targetKm: number | null;
    doneKm: number;
    complete: boolean;
    availableToday: boolean;
    /** Vyns dags löplogg (en per dag och uppdrag), för visning och ångra. */
    todayLog: { id: string; km: number | null } | null;
  } | null;
  goals: { id: string; name: string; metric: TeamGoal['metric']; total: number; target: number; reward: string }[];
  canLogYesterday: boolean;
}

const timeFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function isActiveOn(m: Mission, date: ISODate): boolean {
  return m.activeFrom <= date && (m.activeTo === null || m.activeTo >= date);
}

/** Senast startade aktiva uppdraget av en viss sort. */
function activeMission(missions: Mission[], kind: Mission['kind'], date: ISODate): Mission | null {
  const candidates = missions
    .filter((m) => m.kind === kind && isActiveOn(m, date))
    .sort((a, b) => (a.activeFrom < b.activeFrom ? 1 : a.activeFrom > b.activeFrom ? -1 : a.id.localeCompare(b.id)));
  return candidates[0] ?? null;
}

export function buildTodayView(input: TodayInput): TodayView {
  const { today, logs, missions, goalTotals } = input;
  const now = input.now ?? today;
  const todaysLogs = logs.filter((l) => l.date === today);

  // Händelser: bara träning/match som inte är inställda. `kind` är redan effektiv.
  const events = input.events
    .filter((e) => e.date === today && !e.cancelled && (e.kind === 'training' || e.kind === 'match'))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((e) => {
      const logged = logs.find((l) => l.eventUid === e.uid);
      return {
        uid: e.uid,
        kind: e.kind as 'training' | 'match',
        title: e.summary,
        time: timeFormat.format(e.startsAt),
        checked: logged !== undefined,
        logId: logged?.id ?? null,
      };
    });

  const otherLog = todaysLogs.find((l) => l.type === 'other_org');
  const organized = todaysLogs.some((l) => l.type === 'training' || l.type === 'match' || l.type === 'other_org');

  const daily = activeMission(missions, 'daily', today);
  const extraLog = todaysLogs.find((l) => l.type === 'extra');
  const extra = daily
    ? {
        missionId: daily.id,
        name: daily.name,
        description: daily.description,
        checked: extraLog !== undefined,
        emphasized: !organized,
        logId: extraLog?.id ?? null,
      }
    : null;

  const weeklyMission = activeMission(missions, 'weekly', today);
  let weekly: TodayView['weekly'] = null;
  if (weeklyMission) {
    const week = isoWeekKey(today);
    const mine = logs.filter(
      (l) => l.type === 'weekly' && l.missionId === weeklyMission.id && isoWeekKey(l.date) === week,
    );
    const doneKm = mine.reduce((sum, l) => sum + (l.km ?? 0), 0);
    const todayLog = mine.find((l) => l.date === today);
    weekly = {
      missionId: weeklyMission.id,
      name: weeklyMission.name,
      targetKm: weeklyMission.targetKm,
      doneKm,
      complete: weeklyMission.targetKm === null ? mine.length > 0 : doneKm >= weeklyMission.targetKm,
      availableToday: weeklyMission.weekdays.length === 0 || weeklyMission.weekdays.includes(isoWeekday(today)),
      todayLog: todayLog ? { id: todayLog.id, km: todayLog.km } : null,
    };
  }

  const streak = dayStreak(activeDates(logs), now);
  const currentWeek = isoWeekKey(now);

  return {
    date: today,
    dayStreak: streak.current,
    weekStreak: weekStreak(completedWeeks(logs, missions), now),
    frozenThisWeek: streak.frozenDates.some((d) => isoWeekKey(d) === currentWeek),
    events,
    otherOrg: { checked: otherLog !== undefined, kind: otherLog?.otherKind ?? null, logId: otherLog?.id ?? null },
    extra,
    weekly,
    goals: input.goals
      .filter((g) => g.startsOn <= today && today <= g.endsOn)
      .map((g) => ({
        id: g.id,
        name: g.name,
        metric: g.metric,
        total: goalTotals[g.id] ?? 0,
        target: g.target,
        reward: g.reward ?? '',
      })),
    canLogYesterday: canPlayerLog(addDays(today, -1), now),
  };
}
