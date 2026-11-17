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

function missionActiveInWeek(m: Mission, week: WeekKey): boolean {
  const days = weekDates(week);
  const monday = days[0];
  const sunday = days[6];
  return m.activeFrom <= sunday && (m.activeTo === null || m.activeTo >= monday);
}

/**
 * Veckor där alla weekly-missions som var aktiva under veckan är uppfyllda.
 * Veckotillhörighet styrs av loggens datum. Veckor utan aktiv weekly-mission
 * ingår inte.
 */
export function completedWeeks(logs: LogEntry[], missions: Mission[]): Set<WeekKey> {
  const weeklyMissions = missions.filter((m) => m.kind === 'weekly');
  const weeklyLogs = logs.filter((l) => l.type === 'weekly' && l.missionId !== null);

  // Kandidatveckor: veckor som har minst en weekly-logg.
  const candidates = new Set<WeekKey>(weeklyLogs.map((l) => isoWeekKey(l.date)));
  const result = new Set<WeekKey>();

  for (const week of candidates) {
    const active = weeklyMissions.filter((m) => missionActiveInWeek(m, week));
    if (active.length === 0) continue;
    const inWeek = weeklyLogs.filter((l) => isoWeekKey(l.date) === week);
    const allDone = active.every((m) => {
      const mine = inWeek.filter((l) => l.missionId === m.id);
      if (m.targetKm === null) return mine.length > 0;
      const sum = mine.reduce((acc, l) => acc + (l.km ?? 0), 0);
      return sum >= m.targetKm;
    });
    if (allDone) result.add(week);
  }
  return result;
}
