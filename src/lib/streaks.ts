import { addDays, isoWeekKey } from './dates';
import type { ISODate, WeekKey } from './types';

/**
 * Dagsstreak med 1 frysdag per ISO-vecka (mån–sön).
 * Går bakåt från idag. Idag pågår: är den inte aktiv räknas den inte och
 * förbrukar ingen frysdag. En frusen dag räknas inte i `current`, och frusna
 * dagar före äldsta aktiva dagen i streaken rapporteras inte.
 */
export function dayStreak(
  activeDates: Set<ISODate>,
  today: ISODate,
): { current: number; frozenDates: ISODate[] } {
  if (activeDates.size === 0) return { current: 0, frozenDates: [] };

  let current = 0;
  const frozen: ISODate[] = []; // bekräftade (följs av en aktiv dag längre bak)
  let pending: ISODate[] = []; // frusna sedan senaste aktiva dagen
  const frozenWeeks = new Set<WeekKey>();

  let day = activeDates.has(today) ? today : addDays(today, -1);
  // Slutar senast vid andra missen i en vecka; tom mängd hanterad ovan.
  for (;;) {
    if (activeDates.has(day)) {
      current += 1;
      frozen.push(...pending);
      pending = [];
    } else {
      const week = isoWeekKey(day);
      if (frozenWeeks.has(week)) break;
      frozenWeeks.add(week);
      pending.push(day);
    }
    day = addDays(day, -1);
  }

  return { current, frozenDates: frozen.sort() };
}

/**
 * Veckostreak: veckor i rad bakåt som finns i `completedWeeks`.
 * Pågående vecka som inte är klar bryter inte streaken.
 */
export function weekStreak(completedWeeks: Set<WeekKey>, today: ISODate): number {
  let cursor = today;
  if (!completedWeeks.has(isoWeekKey(cursor))) cursor = addDays(cursor, -7);
  let count = 0;
  while (completedWeeks.has(isoWeekKey(cursor))) {
    count += 1;
    cursor = addDays(cursor, -7);
  }
  return count;
}
