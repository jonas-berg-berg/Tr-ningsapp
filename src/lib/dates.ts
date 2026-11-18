import type { ISODate, WeekKey } from './types';

const TIME_ZONE = 'Europe/Stockholm';

const dateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

// ISODate -> UTC-middag, så att sommartid aldrig påverkar dagsaritmetik.
function toUtcNoon(date: ISODate): Date {
  return new Date(`${date}T12:00:00Z`);
}

function fromUtcNoon(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function toStockholmDate(d: Date): ISODate {
  return dateFormat.format(d);
}

export function stockholmHour(d: Date): number {
  return Number(hourFormat.format(d));
}

export function addDays(date: ISODate, n: number): ISODate {
  const d = toUtcNoon(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtcNoon(d);
}

/** ISO-veckodag: 1 = måndag … 7 = söndag. */
export function isoWeekday(date: ISODate): number {
  const day = toUtcNoon(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isoWeekKey(date: ISODate): WeekKey {
  // Veckans torsdag avgör vilket ISO-år veckan tillhör.
  const thursday = addDays(date, 4 - isoWeekday(date));
  const year = Number(thursday.slice(0, 4));
  const jan1 = toUtcNoon(`${year}-01-01`);
  const dayOfYear = Math.round((toUtcNoon(thursday).getTime() - jan1.getTime()) / 86_400_000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** De sju datumen (måndag–söndag) i en ISO-vecka. */
export function weekDates(week: WeekKey): ISODate[] {
  const match = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!match) throw new Error(`Ogiltig veckonyckel: ${week}`);
  const year = Number(match[1]);
  const weekNo = Number(match[2]);
  // 4 januari ligger alltid i vecka 1.
  const jan4 = `${year}-01-04`;
  const week1Monday = addDays(jan4, 1 - isoWeekday(jan4));
  const monday = addDays(week1Monday, (weekNo - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
