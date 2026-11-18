import ical from 'node-ical';
import type { CalendarEventInput } from '../types';

// node-ical ger { params, val } när en egenskap har parametrar (t.ex. SUMMARY;LANGUAGE=sv).
function text(value: unknown): string | null {
  const v =
    value && typeof value === 'object' && 'val' in value ? (value as { val: unknown }).val : value;
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}

export function parseFeed(ics: string): CalendarEventInput[] {
  const parsed = ical.sync.parseICS(ics);
  const out: CalendarEventInput[] = [];
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT') continue;
    const uid = text(item.uid);
    if (!uid || !item.start) continue;
    const startsAt = new Date(item.start);
    if (Number.isNaN(startsAt.getTime())) continue;
    const endsAt = item.end ? new Date(item.end) : startsAt;
    out.push({
      uid,
      summary: (text(item.summary) ?? '').trim(),
      startsAt,
      endsAt: Number.isNaN(endsAt.getTime()) ? startsAt : endsAt,
      location: text(item.location),
      description: text(item.description),
    });
  }
  return out;
}
