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

/**
 * Alla streaks i historiken, en per dag där en streak tar slut (aktiv dag vars
 * nästa dag inte är aktiv). Varje streak räknas med `dayStreak` från sin sista
 * dag, så frysregeln är exakt densamma. En streak som slutar på dag d+1 är alltid
 * en längre än den som slutar på d, så bara slutdagarna behöver räknas.
 */
export function historicStreaks(
  activeDates: Set<ISODate>,
): { end: ISODate; current: number; frozenDates: ISODate[] }[] {
  const result: { end: ISODate; current: number; frozenDates: ISODate[] }[] = [];
  for (const day of activeDates) {
    if (activeDates.has(addDays(day, 1))) continue;
    result.push({ end: day, ...dayStreak(activeDates, day) });
  }
  return result.sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

/** Längsta dagstreaken i hela historiken, med samma frysregel som `dayStreak`. */
export function longestStreak(activeDates: Set<ISODate>): number {
  return historicStreaks(activeDates).reduce((max, s) => Math.max(max, s.current), 0);
}
