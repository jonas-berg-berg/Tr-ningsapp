import { toStockholmDate } from '../dates';
import type { CalendarEvent, CalendarEventInput } from '../types';
import { classifyEvent } from './classify';

/** Det diffen behöver veta om rader som redan finns i databasen. */
export interface ExistingEvent {
  uid: string;
  startsAt: Date;
  cancelled: boolean;
}

export function diffEvents(
  incoming: CalendarEventInput[],
  existing: ExistingEvent[],
  now: Date,
): { upserts: CalendarEvent[]; cancelUids: string[] } {
  const upserts: CalendarEvent[] = incoming.map((e) => ({
    ...e,
    kind: classifyEvent(e.summary),
    date: toStockholmDate(e.startsAt),
    cancelled: false,
  }));
  const seen = new Set(incoming.map((e) => e.uid));
  const cancelUids = existing
    .filter((e) => !seen.has(e.uid) && !e.cancelled && e.startsAt.getTime() > now.getTime())
    .map((e) => e.uid);
  return { upserts, cancelUids };
}
