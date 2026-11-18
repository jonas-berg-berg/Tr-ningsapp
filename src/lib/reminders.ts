import { isoWeekKey, isoWeekday, stockholmHour, toStockholmDate } from './dates';
import {
  activeDates, activeMission, completedWeeks, governingWeeklyMission, missionLoggableOn, weeksWithoutMission,
} from './logging';
import { dayStreak, weekStreak } from './streaks';
import type { LogEntry, Mission } from './types';

export interface ReminderDue {
  playerId: string;
  kind: 'daily' | 'weekly';
  streak: number;
  /** Bara för daily: finns ett aktivt dagligt uppdrag idag (styr notistexten)? */
  hasDailyMission?: boolean;
}

/**
 * Vilka spelare ska få push just nu (anropas varje timme av cron).
 * daily: kl 19 Stockholmstid, spelaren har ingen aktiv dag idag.
 * weekly: söndag kl 15, veckans styrande veckouppdrag går att logga idag och
 * veckan är inte klar (samma regel som startsidan och veckostreaken).
 */
export function remindersDue(
  now: Date,
  players: { id: string; logs: LogEntry[] }[],
  missions: Mission[],
): ReminderDue[] {
  const today = toStockholmDate(now);
  const hour = stockholmHour(now);
  const out: ReminderDue[] = [];

  if (hour === 19) {
    const hasDailyMission = activeMission(missions, 'daily', today) !== null;
    for (const p of players) {
      const active = activeDates(p.logs);
      if (!active.has(today)) {
        out.push({ playerId: p.id, kind: 'daily', streak: dayStreak(active, today).current, hasDailyMission });
      }
    }
  }

  if (isoWeekday(today) === 7 && hour === 15) {
    const thisWeek = isoWeekKey(today);
    const governing = governingWeeklyMission(missions, thisWeek);
    if (governing && missionLoggableOn(governing, today)) {
      const skip = weeksWithoutMission(missions, today);
      for (const p of players) {
        const done = completedWeeks(p.logs, missions);
        if (!done.has(thisWeek)) {
          out.push({ playerId: p.id, kind: 'weekly', streak: weekStreak(done, today, skip) });
        }
      }
    }
  }

  return out;
}
