import { addDays, isoWeekday, isoWeekKey, weekDates } from './dates';
import type { ISODate, LogEntry, Mission, WeekKey } from './types';

/** En spelare får logga idag och igår, inget annat. */
export function canPlayerLog(date: ISODate, today: ISODate): boolean {
  return date === today || date === addDays(today, -1);
}

/** Veckouppdraget gäller datumets veckodag. Tom lista betyder alla dagar. */
export function weeklyAllowedOn(weekdays: number[], date: ISODate): boolean {
  return weekdays.length === 0 || weekdays.includes(isoWeekday(date));
}

/** Alla loggtyper (även weekly) gör sin dag aktiv. */
export function activeDates(logs: LogEntry[]): Set<ISODate> {
  return new Set(logs.map((l) => l.date));
}

/** Uppdraget är aktivt datumet (inom activeFrom..activeTo). */
export function missionActiveOn(m: Mission, date: ISODate): boolean {
  return m.activeFrom <= date && (m.activeTo === null || m.activeTo >= date);
}

/** Uppdraget kan loggas datumet: aktivt och (för weekly) på en tillåten veckodag. */
export function missionLoggableOn(m: Mission, date: ISODate): boolean {
  return missionActiveOn(m, date) && (m.kind === 'daily' || weeklyAllowedOn(m.weekdays, date));
}

// Senast startade först; lika startdatum avgörs av id så att valet är stabilt.
function latestFirst(a: Mission, b: Mission): number {
  return a.activeFrom < b.activeFrom ? 1 : a.activeFrom > b.activeFrom ? -1 : a.id.localeCompare(b.id);
}

/** Senast startade aktiva uppdraget av en viss sort på datumet. */
export function activeMission(missions: Mission[], kind: Mission['kind'], date: ISODate): Mission | null {
  return missions.filter((m) => m.kind === kind && missionActiveOn(m, date)).sort(latestFirst)[0] ?? null;
}

/**
 * Veckans styrande veckouppdrag: det senast startade weekly-uppdraget som har
 * minst en loggbar dag i veckan. Används av startsidan, veckostreaken och
 * söndagspåminnelsen så att alla är överens om vad "veckan klar" betyder.
 */
export function governingWeeklyMission(missions: Mission[], week: WeekKey): Mission | null {
  const days = weekDates(week);
  return (
    missions
      .filter((m) => m.kind === 'weekly' && days.some((d) => missionLoggableOn(m, d)))
      .sort(latestFirst)[0] ?? null
  );
}

/** Spelarens framsteg på ett veckouppdrag under en vecka (efter loggens datum). */
export function weeklyProgress(
  logs: LogEntry[],
  mission: Mission,
  week: WeekKey,
): { doneKm: number; complete: boolean } {
  const mine = logs.filter((l) => l.type === 'weekly' && l.missionId === mission.id && isoWeekKey(l.date) === week);
  const doneKm = mine.reduce((acc, l) => acc + (l.km ?? 0), 0);
  const complete = mission.targetKm === null ? mine.length > 0 : doneKm >= mission.targetKm;
  return { doneKm, complete };
}

/**
 * Veckor där veckans styrande veckouppdrag är uppfyllt. Veckotillhörighet
 * styrs av loggens datum. Veckor utan styrande uppdrag ingår inte.
 */
export function completedWeeks(logs: LogEntry[], missions: Mission[]): Set<WeekKey> {
  const weeklyLogs = logs.filter((l) => l.type === 'weekly' && l.missionId !== null);
  // Kandidatveckor: veckor som har minst en weekly-logg.
  const candidates = new Set<WeekKey>(weeklyLogs.map((l) => isoWeekKey(l.date)));
  const result = new Set<WeekKey>();
  for (const week of candidates) {
    const governing = governingWeeklyMission(missions, week);
    if (governing && weeklyProgress(weeklyLogs, governing, week).complete) result.add(week);
  }
  return result;
}

/**
 * Veckor utan styrande veckouppdrag, från veckan då första weekly-uppdraget
 * startade till och med `today`s vecka. Veckostreaken hoppar över dem.
 */
export function weeksWithoutMission(missions: Mission[], today: ISODate): Set<WeekKey> {
  const weekly = missions.filter((m) => m.kind === 'weekly');
  const result = new Set<WeekKey>();
  if (weekly.length === 0) return result;
  const first = weekly.reduce((min, m) => (m.activeFrom < min ? m.activeFrom : min), weekly[0].activeFrom);
  const lastWeek = isoWeekKey(today);
  // Veckonycklar 'YYYY-Www' sorteras rätt som strängar.
  for (let day = first; isoWeekKey(day) <= lastWeek; day = addDays(day, 7)) {
    const week = isoWeekKey(day);
    if (!governingWeeklyMission(missions, week)) result.add(week);
  }
  return result;
}
