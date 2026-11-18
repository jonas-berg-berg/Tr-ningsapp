import { describe, expect, it } from 'vitest';
import type { CalendarEventInput } from '../types';
import { diffEvents, type ExistingEvent } from './diff';

const now = new Date('2026-11-17T12:00:00Z');
const input = (over: Partial<CalendarEventInput>): CalendarEventInput => ({
  uid: 'a',
  summary: 'Träning',
  startsAt: new Date('2026-11-20T18:00:00Z'),
  endsAt: new Date('2026-11-20T19:00:00Z'),
  location: null,
  description: null,
  ...over,
});
const existing = (over: Partial<ExistingEvent>): ExistingEvent => ({
  uid: 'x',
  startsAt: new Date('2026-11-25T18:00:00Z'),
  cancelled: false,
  ...over,
});

describe('diffEvents', () => {
  it('ny händelse blir upsert med kind och datum', () => {
    const { upserts } = diffEvents(
      [input({ uid: 'm', summary: 'Match: Lerum - X', startsAt: new Date('2026-12-06T10:00:00Z') })],
      [],
      now,
    );
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ uid: 'm', kind: 'match', date: '2026-12-06', cancelled: false });
  });
  it('framtida som saknas avbokas', () => {
    expect(diffEvents([], [existing({ uid: 'f' })], now).cancelUids).toEqual(['f']);
  });
  it('passerad som saknas rörs inte', () => {
    expect(
      diffEvents([], [existing({ uid: 'p', startsAt: new Date('2026-11-01T18:00:00Z') })], now).cancelUids,
    ).toEqual([]);
  });
  it('redan avbokad som saknas avbokas inte igen', () => {
    expect(diffEvents([], [existing({ uid: 'c', cancelled: true })], now).cancelUids).toEqual([]);
  });
  it('avbokad som dyker upp igen återställs', () => {
    const { upserts, cancelUids } = diffEvents([input({ uid: 'c' })], [existing({ uid: 'c', cancelled: true })], now);
    expect(upserts[0].cancelled).toBe(false);
    expect(cancelUids).toEqual([]);
  });
});
