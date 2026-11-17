import { addDays, stockholmHour, toStockholmDate } from './dates';

const minuteFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Stockholm', minute: '2-digit' });

/**
 * Sekunder kvar till nästa midnatt i Stockholm (minst 60). Används som push-TTL:
 * en påminnelse om "dagens" träning är meningslös efter midnatt.
 */
export function secondsUntilStockholmMidnight(now: Date): number {
  const next = addDays(toStockholmDate(now), 1);
  const utcMidnight = Date.parse(`${next}T00:00:00Z`);
  // Stockholm ligger UTC+1 (vinter) eller UTC+2 (sommar).
  let target = utcMidnight - 3_600_000;
  for (const offsetHours of [1, 2]) {
    const candidate = new Date(utcMidnight - offsetHours * 3_600_000);
    if (
      toStockholmDate(candidate) === next &&
      stockholmHour(candidate) === 0 &&
      Number(minuteFormat.format(candidate)) === 0
    ) {
      target = candidate.getTime();
      break;
    }
  }
  return Math.max(60, Math.round((target - now.getTime()) / 1000));
}
