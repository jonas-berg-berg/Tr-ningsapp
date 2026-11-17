import { addDays } from '../dates';
import { activeDates } from '../logging';
import { dayStreak, historicStreaks, longestStreak } from '../streaks';
import type { ISODate, LogEntry, LogType } from '../types';

export interface MonthDay {
  date: ISODate;
  active: boolean;
  frozen: boolean;
}

export interface MonthStats {
  days: MonthDay[];
  /** Längsta dagstreaken i hela historiken (inte bara månaden). */
  longestStreak: number;
  /** Antal pass per typ i månaden. */
  countsByType: Record<LogType, number>;
  /** Löpta km i månaden. */
  totalKm: number;
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** Alla datum i månaden 'YYYY-MM'. */
export function monthDates(month: string): ISODate[] {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Ogiltig månad: ${month}`);
  const first = `${month}-01`;
  const dates: ISODate[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) dates.push(d);
  return dates;
}

/**
 * Månadsstatistik för en spelare. Frusna dagar är dagar som en frysdag har
 * överbryggat i någon streak i historiken, eller i den pågående streaken.
 */
export function buildMonthStats(logs: LogEntry[], month: string, today: ISODate): MonthStats {
  const active = activeDates(logs.filter((l) => l.date <= today));

  const frozen = new Set<ISODate>(dayStreak(active, today).frozenDates);
  for (const s of historicStreaks(active)) s.frozenDates.forEach((d) => frozen.add(d));

  const days = monthDates(month).map((date) => ({
    date,
    active: date <= today && active.has(date),
    frozen: date <= today && frozen.has(date),
  }));

  const countsByType: Record<LogType, number> = { training: 0, match: 0, other_org: 0, extra: 0, weekly: 0 };
  let totalKm = 0;
  for (const l of logs) {
    if (!l.date.startsWith(`${month}-`)) continue;
    countsByType[l.type] += 1;
    totalKm += l.km ?? 0;
  }

  return { days, longestStreak: longestStreak(active), countsByType, totalKm };
}
