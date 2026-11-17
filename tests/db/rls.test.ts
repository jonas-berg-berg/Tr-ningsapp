import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Integrationstester för schema och RLS mot lokal PostgreSQL (se supabase/tests/shim.sql).
const HOST = process.env.PGHOST ?? '127.0.0.1';
const PORT = Number(process.env.PGPORT ?? 54329);
const USER = process.env.PGUSER ?? 'postgres';
const TEST_DB = 'traningsappen_test';

const ROOT = join(__dirname, '..', '..');
const SHIM = join(ROOT, 'supabase', 'tests', 'shim.sql');
const MIGRATION = join(ROOT, 'supabase', 'migrations', '0001_init.sql');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const COACH = '00000000-0000-0000-0000-0000000000cc';
const GOAL_SESSIONS = '10000000-0000-0000-0000-000000000001';
const GOAL_EXTRA = '10000000-0000-0000-0000-000000000002';
const GOAL_KM = '10000000-0000-0000-0000-000000000003';

const TODAY = "((now() at time zone 'Europe/Stockholm')::date)";

let db: Client;

function admin(database: string) {
  return new Client({ host: HOST, port: PORT, user: USER, database });
}

/** Kör fn som given användare (null = anon) i en transaktion som alltid rullas tillbaka. */
async function as<T>(sub: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query('begin');
  try {
    if (sub) {
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role: 'authenticated' }),
      ]);
    } else {
      await db.query('set local role anon');
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: 'anon' }),
      ]);
    }
    return await fn(db);
  } finally {
    await db.query('rollback');
  }
}

async function sqlState(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

function count(c: Client, sql: string, params: unknown[] = []) {
  return c.query<{ n: string }>(sql, params).then((r) => Number(r.rows[0].n));
}

beforeAll(async () => {
  const root = admin('postgres');
  await root.connect();
  await root.query(`drop database if exists ${TEST_DB} with (force)`);
  await root.query(`create database ${TEST_DB}`);
  await root.end();

  db = admin(TEST_DB);
  await db.connect();
  await db.query(readFileSync(SHIM, 'utf8'));
  await db.query(readFileSync(MIGRATION, 'utf8'));

  // Seed som superuser (förbi RLS).
  await db.query(
    `insert into auth.users (id, email) values ($1, 'a@x'), ($2, 'b@x'), ($3, 'c@x')`,
    [A, B, COACH],
  );
  await db.query(
    `insert into profiles (id, display_name, username, role) values
       ($1, 'Spelare A', 'a', 'player'),
       ($2, 'Spelare B', 'b', 'player'),
       ($3, 'Tränaren', 'coach', 'coach')`,
    [A, B, COACH],
  );
  await db.query(
    `insert into logs (player_id, date, type, km) values
       ($1, ${TODAY},      'training', null),
       ($1, ${TODAY} - 1,  'extra',    3),
       ($2, ${TODAY},      'extra',    5),
       ($2, ${TODAY} - 3,  'match',    null),
       ($2, ${TODAY} - 30, 'extra',    100)`,
    [A, B],
  );
  await db.query(
    `insert into team_goals (id, name, metric, target, starts_on, ends_on, reward) values
       ($1, 'Pass', 'sessions', 100, ${TODAY} - 7, ${TODAY} + 7, 'Pizza'),
       ($2, 'Extra', 'extra', 50, ${TODAY} - 7, ${TODAY} + 7, 'Glass'),
       ($3, 'Km', 'km', 200, ${TODAY} - 7, ${TODAY} + 7, 'Bad')`,
    [GOAL_SESSIONS, GOAL_EXTRA, GOAL_KM],
  );
  await db.query(
    `insert into calendar_events (uid, summary, kind, kind_override, date, starts_at, ends_at)
     values ('ev-1', 'Träning', 'training', null, ${TODAY}, now(), now()),
            ('ev-2', 'Cup', 'other', 'match', ${TODAY}, now(), now())`,
  );
  await db.query(`insert into settings (key, value) values ('ical_url', 'https://hemligt')`);
  await db.query(
    `insert into missions (kind, name, active_from) values ('daily', 'Skott', ${TODAY})`,
  );
});

afterAll(async () => {
  await db?.end();
});

describe('logs', () => {
  it('A ser 0 av B:s loggar men sina egna', async () => {
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from logs where player_id = $1', [B])).toBe(0);
      expect(await count(c, 'select count(*) n from logs')).toBe(2);
    });
  });

  it('A kan inte infoga en logg med player_id = B', async () => {
    const code = await as(A, (c) =>
      sqlState(c.query(`insert into logs (player_id, date, type) values ($1, ${TODAY}, 'extra')`, [B])),
    );
    expect(code).toBe('42501');
  });

  it('A kan inte infoga en logg daterad idag − 2', async () => {
    const code = await as(A, (c) =>
      sqlState(c.query(`insert into logs (player_id, date, type) values ($1, ${TODAY} - 2, 'extra')`, [A])),
    );
    expect(code).toBe('42501');
  });

  it('A kan inte infoga en logg daterad idag + 1', async () => {
    const code = await as(A, (c) =>
      sqlState(c.query(`insert into logs (player_id, date, type) values ($1, ${TODAY} + 1, 'extra')`, [A])),
    );
    expect(code).toBe('42501');
  });

  it('A kan infoga loggar daterade idag och idag − 1, created_by blir A', async () => {
    await as(A, async (c) => {
      const r = await c.query(
        `insert into logs (player_id, date, type, other_kind) values
           ($1, ${TODAY}, 'other_org', 'fotboll'),
           ($1, ${TODAY} - 1, 'other_org', 'annat_lag')
         returning created_by`,
        [A],
      );
      expect(r.rowCount).toBe(2);
      expect(r.rows.every((row) => row.created_by === A)).toBe(true);
    });
  });

  it('A kan inte förfalska created_by', async () => {
    const code = await as(A, (c) =>
      sqlState(
        c.query(`insert into logs (player_id, date, type, created_by) values ($1, ${TODAY}, 'extra', $2)`, [A, COACH]),
      ),
    );
    expect(code).toBe('42501');
  });

  it('dubbel insert av samma (player_id, event_uid) ger unique_violation', async () => {
    const code = await as(A, async (c) => {
      await c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY}, 'training', 'ev-1')`, [A]);
      return sqlState(
        c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY} - 1, 'training', 'ev-1')`, [A]),
      );
    });
    expect(code).toBe('23505');
  });

  it('A kan inte uppdatera eller radera B:s loggar', async () => {
    await as(A, async (c) => {
      const upd = await c.query(`update logs set km = 99 where player_id = $1`, [B]);
      const del = await c.query(`delete from logs where player_id = $1`, [B]);
      expect(upd.rowCount).toBe(0);
      expect(del.rowCount).toBe(0);
      await c.query('reset role');
      expect(await count(c, 'select count(*) n from logs where player_id = $1 and km = 99', [B])).toBe(0);
      expect(await count(c, 'select count(*) n from logs where player_id = $1', [B])).toBe(3);
    });
  });

  it('A kan inte uppdatera sina egna loggar', async () => {
    await as(A, async (c) => {
      const upd = await c.query(`update logs set date = ${TODAY} - 10 where player_id = $1`, [A]);
      expect(upd.rowCount).toBe(0);
    });
  });

  it('A kan radera egen logg inom fönstret men inte äldre', async () => {
    await as(A, async (c) => {
      await c.query('reset role');
      await c.query(`insert into logs (player_id, date, type) values ($1, ${TODAY} - 5, 'extra')`, [A]);
      await c.query('set local role authenticated');
      const old = await c.query(`delete from logs where player_id = $1 and date = ${TODAY} - 5`, [A]);
      const recent = await c.query(`delete from logs where player_id = $1 and date = ${TODAY}`, [A]);
      expect(old.rowCount).toBe(0);
      expect(recent.rowCount).toBe(1);
    });
  });

  it('tränaren ser alla loggar och kan skriva för spelare', async () => {
    await as(COACH, async (c) => {
      expect(await count(c, 'select count(*) n from logs')).toBe(5);
      const r = await c.query(`insert into logs (player_id, date, type) values ($1, ${TODAY} - 20, 'extra')`, [B]);
      expect(r.rowCount).toBe(1);
    });
  });

  it('anon ser inga loggar', async () => {
    await as(null, async (c) => {
      expect(await count(c, 'select count(*) n from logs')).toBe(0);
    });
  });

  it('loggen finns kvar när kalenderhändelsen raderas', async () => {
    await as(COACH, async (c) => {
      await c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY}, 'training', 'ev-1')`, [A]);
      const del = await c.query(`delete from calendar_events where uid = 'ev-1'`);
      expect(del.rowCount).toBe(1);
      expect(await count(c, `select count(*) n from logs where event_uid = 'ev-1'`)).toBe(1);
    });
  });
});

describe('profiles', () => {
  it('A ser bara sin egen profil', async () => {
    await as(A, async (c) => {
      const r = await c.query('select id from profiles');
      expect(r.rows.map((row) => row.id)).toEqual([A]);
    });
  });

  it('A kan inte göra sig själv till coach', async () => {
    await as(A, async (c) => {
      const upd = await c.query(`update profiles set role = 'coach' where id = $1`, [A]);
      expect(upd.rowCount).toBe(0);
      expect((await c.query('select is_coach() ok')).rows[0].ok).toBe(false);
    });
  });

  it('A kan inte skapa eller radera profiler', async () => {
    await as(A, async (c) => {
      const del = await c.query('delete from profiles');
      expect(del.rowCount).toBe(0);
    });
    const code = await as(A, (c) =>
      sqlState(c.query(`insert into profiles (id, display_name, username) values ($1, 'x', 'x')`, [B])),
    );
    expect(code).toBe('42501');
  });

  it('tränaren ser alla profiler och is_coach() är sant', async () => {
    await as(COACH, async (c) => {
      expect(await count(c, 'select count(*) n from profiles')).toBe(3);
      expect((await c.query('select is_coach() ok')).rows[0].ok).toBe(true);
    });
  });

  it('anon ser inga profiler', async () => {
    await as(null, async (c) => {
      expect(await count(c, 'select count(*) n from profiles')).toBe(0);
    });
  });
});

describe('settings och invites', () => {
  it('A kan inte läsa eller skriva settings', async () => {
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from settings')).toBe(0);
    });
    const code = await as(A, (c) => sqlState(c.query(`insert into settings (key, value) values ('x', 'y')`)));
    expect(code).toBe('42501');
  });

  it('tränaren kan läsa settings', async () => {
    await as(COACH, async (c) => {
      expect(await count(c, 'select count(*) n from settings')).toBe(1);
    });
  });

  it('bara tränaren kan hantera inbjudningar', async () => {
    const code = await as(A, (c) => sqlState(c.query(`insert into invites (display_name) values ('Ny')`)));
    expect(code).toBe('42501');
    await as(COACH, async (c) => {
      const r = await c.query(`insert into invites (display_name) values ('Ny') returning token, role, created_by`);
      expect(r.rows[0].role).toBe('player');
      expect(r.rows[0].created_by).toBe(COACH);
    });
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from invites')).toBe(0);
    });
  });
});

describe('kalender, uppdrag och lagmål', () => {
  it('inloggad spelare kan läsa men inte skriva', async () => {
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from calendar_events')).toBe(2);
      expect(await count(c, 'select count(*) n from missions')).toBe(1);
      expect(await count(c, 'select count(*) n from team_goals')).toBe(3);
    });
    for (const sql of [
      `insert into calendar_events (uid, summary, kind) values ('x', 'x', 'training')`,
      `insert into missions (kind, name, active_from) values ('daily', 'x', current_date)`,
      `insert into team_goals (name, metric, target, starts_on, ends_on) values ('x', 'km', 1, current_date, current_date)`,
    ]) {
      expect(await as(A, (c) => sqlState(c.query(sql)))).toBe('42501');
    }
    await as(A, async (c) => {
      expect((await c.query(`update calendar_events set kind_override = 'match'`)).rowCount).toBe(0);
      expect((await c.query(`delete from team_goals`)).rowCount).toBe(0);
    });
  });

  it('vyn ger effektiv typ och respekterar RLS', async () => {
    await as(A, async (c) => {
      const r = await c.query(`select uid, kind from calendar_events_effective order by uid`);
      expect(r.rows).toEqual([
        { uid: 'ev-1', kind: 'training' },
        { uid: 'ev-2', kind: 'match' },
      ]);
    });
    await as(null, async (c) => {
      expect(await count(c, 'select count(*) n from calendar_events_effective')).toBe(0);
    });
  });

  it('tränaren kan skriva kalender, uppdrag och lagmål', async () => {
    await as(COACH, async (c) => {
      await c.query(`update calendar_events set kind_override = 'match' where uid = 'ev-1'`);
      await c.query(`insert into missions (kind, name, active_from) values ('weekly', 'Löpning', current_date)`);
      await c.query(
        `insert into team_goals (name, metric, target, starts_on, ends_on) values ('x', 'km', 1, current_date, current_date)`,
      );
      expect(await count(c, `select count(*) n from calendar_events_effective where kind = 'match'`)).toBe(2);
    });
  });
});

describe('team_goal_total', () => {
  it('summerar både A:s och B:s loggar när A anropar', async () => {
    await as(A, async (c) => {
      const total = async (id: string) =>
        Number((await c.query('select team_goal_total($1) t', [id])).rows[0].t);
      expect(await total(GOAL_SESSIONS)).toBe(4);
      expect(await total(GOAL_EXTRA)).toBe(2);
      expect(await total(GOAL_KM)).toBe(8);
    });
  });

  it('anon kan inte anropa den', async () => {
    const code = await as(null, (c) => sqlState(c.query('select team_goal_total($1)', [GOAL_KM])));
    expect(code).toBe('42501');
  });
});

describe('push_subscriptions', () => {
  it('bara egna rader', async () => {
    await as(A, async (c) => {
      await c.query(
        `insert into push_subscriptions (player_id, endpoint, p256dh, auth) values ($1, 'https://p/a', 'k', 's')`,
        [A],
      );
      expect(await count(c, 'select count(*) n from push_subscriptions')).toBe(1);
    });
    const code = await as(A, (c) =>
      sqlState(
        c.query(
          `insert into push_subscriptions (player_id, endpoint, p256dh, auth) values ($1, 'https://p/b', 'k', 's')`,
          [B],
        ),
      ),
    );
    expect(code).toBe('42501');
    await as(B, async (c) => {
      await c.query('reset role');
      await c.query(
        `insert into push_subscriptions (player_id, endpoint, p256dh, auth) values ($1, 'https://p/b', 'k', 's')`,
        [B],
      );
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A, role: 'authenticated' })]);
      expect(await count(c, 'select count(*) n from push_subscriptions')).toBe(0);
      expect((await c.query('delete from push_subscriptions')).rowCount).toBe(0);
    });
  });
});
