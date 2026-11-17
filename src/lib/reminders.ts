import { isoWeekKey, isoWeekday, stockholmHour, toStockholmDate } from './dates';
import { activeDates, completedWeeks } from './logging';
import { dayStreak, weekStreak } from './streaks';
import type { LogEntry, Mission } from './types';

export interface ReminderDue {
  playerId: string;
  kind: 'daily' | 'weekly';
  streak: number;
}

/**
 * Vilka spelare ska få push just nu (anropas varje timme av cron).
 * daily: kl 19 Stockholmstid, spelaren har ingen aktiv dag idag.
 * weekly: söndag kl 15, aktiv weekly-mission idag och veckan ej klar.
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
    for (const p of players) {
      const active = activeDates(p.logs);
      if (!active.has(today)) {
        out.push({ playerId: p.id, kind: 'daily', streak: dayStreak(active, today).current });
      }
    }
  }

  if (isoWeekday(today) === 7 && hour === 15) {
    const hasActiveWeekly = missions.some(
      (m) => m.kind === 'weekly' && m.activeFrom <= today && (m.activeTo === null || m.activeTo >= today),
    );
    if (hasActiveWeekly) {
      const thisWeek = isoWeekKey(today);
      for (const p of players) {
        const done = completedWeeks(p.logs, missions);
        if (!done.has(thisWeek)) {
          out.push({ playerId: p.id, kind: 'weekly', streak: weekStreak(done, today) });
        }
      }
    }
  }

  return out;
}
