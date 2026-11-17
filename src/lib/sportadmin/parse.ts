import ical from 'node-ical';
import type { CalendarEventInput } from '../types';

export function parseFeed(ics: string): CalendarEventInput[] {
  const parsed = ical.sync.parseICS(ics);
  const out: CalendarEventInput[] = [];
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== 'VEVENT') continue;
    const startsAt = new Date(item.start);
    out.push({
      uid: item.uid,
      summary: String(item.summary ?? '').trim(),
      startsAt,
      endsAt: item.end ? new Date(item.end) : startsAt,
      location: item.location ? String(item.location) : null,
      description: item.description ? String(item.description) : null,
    });
  }
  return out;
}
