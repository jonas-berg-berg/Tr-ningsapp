import { addDays } from '../dates';
import { activeDates } from '../logging';
import { dayStreak } from '../streaks';
import type { ISODate, LogEntry } from '../types';

export interface CoachRow {
  id: string;
  name: string;
  activeToday: boolean;
  dayStreak: number;
  active7: number;
  active30: number;
}

export type CoachSortKey = 'name' | 'today' | 'streak' | 'active7' | 'active30';
export type SortDir = 'asc' | 'desc';

export const COACH_SORT_KEYS: CoachSortKey[] = ['name', 'today', 'streak', 'active7', 'active30'];

/** Antal aktiva dagar i today − (n − 1) .. today. */
function activeInLast(dates: Set<ISODate>, today: ISODate, n: number): number {
  const from = addDays(today, -(n - 1));
  let count = 0;
  for (const d of dates) if (d >= from && d <= today) count += 1;
  return count;
}

export function buildCoachOverview(
  players: { id: string; name: string; logs: LogEntry[] }[],
  today: ISODate,
): CoachRow[] {
  return players.map((p) => {
    const dates = activeDates(p.logs);
    return {
      id: p.id,
      name: p.name,
      activeToday: dates.has(today),
      dayStreak: dayStreak(dates, today).current,
      active7: activeInLast(dates, today, 7),
      active30: activeInLast(dates, today, 30),
    };
  });
}

const byName = (a: CoachRow, b: CoachRow) => a.name.localeCompare(b.name, 'sv');

const VALUE: Record<Exclude<CoachSortKey, 'name'>, (r: CoachRow) => number> = {
  today: (r) => (r.activeToday ? 1 : 0),
  streak: (r) => r.dayStreak,
  active7: (r) => r.active7,
  active30: (r) => r.active30,
};

/** Sorterar en kopia. Lika värden sorteras alltid på namn (A–Ö). */
export function sortCoachOverview(rows: CoachRow[], key: CoachSortKey, dir: SortDir): CoachRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const diff = VALUE[key](a) - VALUE[key](b);
    return diff !== 0 ? sign * diff : byName(a, b);
  });
}
