import { describe, expect, it } from 'vitest';
import { runReminders, type PushResult } from './reminders-run';

type Tables = Record<string, Record<string, unknown>[]>;

/** Minimal PostgREST-fake: select/eq/order/range/in/delete, väntbar. */
function fakeSupabase(tables: Tables, deleted: { table: string; endpoints: string[] }[] = []) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let op: 'select' | 'delete' = 'select';
      let inFilter: { col: string; vals: unknown[] } | null = null;
      const b = {
        select: () => b,
        order: () => b,
        eq: (col: string, v: unknown) => {
          rows = rows.filter((r) => r[col] === v);
          return b;
        },
        range: (from: number, to: number) => {
          rows = rows.slice(from, to + 1);
          return b;
        },
        in: (col: string, vals: unknown[]) => {
          inFilter = { col, vals };
          return b;
        },
        delete: () => {
          op = 'delete';
          return b;
        },
        then(resolve: (v: unknown) => unknown) {
          if (op === 'delete') {
            deleted.push({ table, endpoints: (inFilter?.vals ?? []) as string[] });
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return b;
    },
  };
}

const NOW = new Date('2026-11-18T18:00:00Z'); // 19:00 Stockholm, onsdag
const sub = (playerId: string, endpoint: string) => ({ id: endpoint, player_id: playerId, endpoint, p256dh: 'k', auth: 'a' });
const base = (): Tables => ({
  profiles: [
    { id: 'a', role: 'player' },
    { id: 'b', role: 'player' },
    { id: 'c', role: 'coach' },
  ],
  logs: [
    { id: 'l1', player_id: 'a', date: '2026-11-17', type: 'training', event_uid: null, other_kind: null, mission_id: null, km: null },
    { id: 'l2', player_id: 'b', date: '2026-11-18', type: 'training', event_uid: null, other_kind: null, mission_id: null, km: null },
  ],
  missions: [],
  push_subscriptions: [sub('a', 'https://p/1'), sub('a', 'https://p/2'), sub('b', 'https://p/3'), sub('c', 'https://p/4')],
});

describe('runReminders', () => {
  it('skickar till alla prenumerationer för spelare som är aktuella', async () => {
    const calls: { endpoint: string; title: string }[] = [];
    const deleted: { table: string; endpoints: string[] }[] = [];
    const res = await runReminders({
      supabase: fakeSupabase(base(), deleted) as never,
      now: () => NOW,
      sendPush: async (s, p): Promise<PushResult> => {
        calls.push({ endpoint: s.endpoint, title: p.title });
        return 'sent';
      },
    });
    expect(res).toEqual({ sent: 2, removed: 0 });
    expect(calls).toEqual([
      { endpoint: 'https://p/1', title: 'Din streak på 1 dag väntar 🔥' },
      { endpoint: 'https://p/2', title: 'Din streak på 1 dag väntar 🔥' },
    ]);
    expect(deleted).toEqual([]);
  });

  it('tar bort döda prenumerationer och räknar bara skickade', async () => {
    const deleted: { table: string; endpoints: string[] }[] = [];
    const res = await runReminders({
      supabase: fakeSupabase(base(), deleted) as never,
      now: () => NOW,
      sendPush: async (s): Promise<PushResult> => (s.endpoint === 'https://p/1' ? 'gone' : 'error'),
    });
    expect(res).toEqual({ sent: 0, removed: 1 });
    expect(deleted).toEqual([{ table: 'push_subscriptions', endpoints: ['https://p/1'] }]);
  });

  it('fel timme ger inget', async () => {
    let n = 0;
    const res = await runReminders({
      supabase: fakeSupabase(base()) as never,
      now: () => new Date('2026-11-18T10:00:00Z'),
      sendPush: async () => {
        n++;
        return 'sent';
      },
    });
    expect(res).toEqual({ sent: 0, removed: 0 });
    expect(n).toBe(0);
  });
});
