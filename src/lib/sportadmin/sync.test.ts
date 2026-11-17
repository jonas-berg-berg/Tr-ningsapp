import { describe, expect, it, vi } from 'vitest';
import { CalendarSyncError, runCalendarSync, type SyncDeps } from './sync';

const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\nBEGIN:VEVENT\r\nUID:new1\r\nDTSTART:20261206T100000Z\r\nDTEND:20261206T110000Z\r\nSUMMARY:Match: Lerum - X\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

function fakeSupabase(opts: { url?: string | null; existing?: unknown[] } = {}) {
  const calls = { upsert: [] as unknown[], update: [] as unknown[], inUids: [] as unknown[] };
  const url = opts.url === undefined ? 'webcal://portalweb.sportadmin.se/webcal?id=abc' : opts.url;
  const client = {
    from(table: string) {
      if (table === 'settings') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: url ? { value: url } : null, error: null }) }),
          }),
        };
      }
      return {
        select: () => ({ gt: async () => ({ data: opts.existing ?? [], error: null }) }),
        upsert: async (rows: unknown, o: unknown) => {
          calls.upsert.push({ rows, o });
          return { error: null };
        },
        update: (patch: unknown) => ({
          in: async (_col: string, uids: unknown) => {
            calls.update.push(patch);
            calls.inUids.push(uids);
            return { error: null };
          },
        }),
      };
    },
  };
  return { client: client as unknown as SyncDeps['supabase'], calls };
}

const now = () => new Date('2026-11-17T12:00:00Z');
const ok = (body = ics) => vi.fn(async () => new Response(body, { status: 200 }));

describe('runCalendarSync', () => {
  it('kastar CalendarSyncError när URL saknas', async () => {
    const { client } = fakeSupabase({ url: null });
    const fetchFn = ok();
    await expect(runCalendarSync({ supabase: client, fetchFn, now })).rejects.toBeInstanceOf(CalendarSyncError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
  it('kastar och skriver inget vid icke-200', async () => {
    const { client, calls } = fakeSupabase();
    const fetchFn = vi.fn(async () => new Response('no', { status: 500 }));
    await expect(runCalendarSync({ supabase: client, fetchFn, now })).rejects.toBeInstanceOf(CalendarSyncError);
    expect(calls.upsert).toHaveLength(0);
    expect(calls.update).toHaveLength(0);
  });
  it('kastar och skriver inget vid nätverksfel', async () => {
    const { client, calls } = fakeSupabase();
    const fetchFn = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(runCalendarSync({ supabase: client, fetchFn, now })).rejects.toBeInstanceOf(CalendarSyncError);
    expect(calls.upsert).toHaveLength(0);
  });
  it('hämtar https-URL för webcal:// med no-store', async () => {
    const { client } = fakeSupabase();
    const fetchFn = ok();
    await runCalendarSync({ supabase: client, fetchFn, now });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://portalweb.sportadmin.se/webcal?id=abc');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeDefined();
  });
  it('upsertar klassade rader utan kind_override och avbokar saknade framtida', async () => {
    const { client, calls } = fakeSupabase({
      existing: [{ uid: 'gone', starts_at: '2026-11-30T10:00:00Z', cancelled: false }],
    });
    const res = await runCalendarSync({ supabase: client, fetchFn: ok(), now });
    expect(res).toEqual({ upserted: 1, cancelled: 1 });
    const { rows, o } = calls.upsert[0] as { rows: Record<string, unknown>[]; o: unknown };
    expect(o).toEqual({ onConflict: 'uid' });
    expect(rows[0]).toMatchObject({
      uid: 'new1',
      kind: 'match',
      date: '2026-12-06',
      cancelled: false,
      starts_at: '2026-12-06T10:00:00.000Z',
    });
    expect(rows[0]).not.toHaveProperty('kind_override');
    expect(rows[0]).not.toHaveProperty('description');
    expect(calls.inUids[0]).toEqual(['gone']);
    expect(calls.update[0]).toMatchObject({ cancelled: true });
  });
});
