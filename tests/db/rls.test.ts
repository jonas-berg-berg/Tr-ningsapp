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
// 0002_cron.sql kräver Supabase och laddas aldrig här.
const MIGRATIONS = ['0001_init.sql', '0003_jersey_number.sql', '0004_extra_per_mission.sql'].map((f) => join(ROOT, 'supabase', 'migrations', f));

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const COACH = '00000000-0000-0000-0000-0000000000cc';
// Har ett auth-konto (t.ex. egen registrering) men ingen profil: inte med i laget.
const STRANGER = '00000000-0000-0000-0000-0000000000ff';
const GOAL_SESSIONS = '10000000-0000-0000-0000-000000000001';
const GOAL_EXTRA = '10000000-0000-0000-0000-000000000002';
const GOAL_KM = '10000000-0000-0000-0000-000000000003';
const M_DAILY = '20000000-0000-0000-0000-000000000001';
const M_WEEKLY = '20000000-0000-0000-0000-000000000002';
const M_OLD = '20000000-0000-0000-0000-000000000003';

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

/** Byt identitet mitt i en transaktion som startats av as(). */
async function switchTo(c: Client, sub: string) {
  await c.query('set local role authenticated');
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub, role: 'authenticated' }),
  ]);
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
  for (const m of MIGRATIONS) await db.query(readFileSync(m, 'utf8'));

  // Seed som superuser (förbi RLS).
  await db.query(
    `insert into auth.users (id, email) values ($1, 'a@x'), ($2, 'b@x'), ($3, 'c@x'), ($4, 'f@x')`,
    [A, B, COACH, STRANGER],
  );
  await db.query(
    `insert into profiles (id, display_name, username, role) values
       ($1, 'Spelare A', 'a', 'player'),
       ($2, 'Spelare B', 'b', 'player'),
       ($3, 'Tränaren', 'coach', 'coach')`,
    [A, B, COACH],
  );
  await db.query(
    `insert into missions (id, kind, name, target_km, active_from, active_to) values
       ($1, 'daily',  'Splits',   null, ${TODAY} - 60, null),
       ($2, 'weekly', 'Löpning',  8,    ${TODAY} - 60, null),
       ($3, 'daily',  'Gammalt',  null, ${TODAY} - 60, ${TODAY} - 10)`,
    [M_DAILY, M_WEEKLY, M_OLD],
  );
  // I lagmålens intervall: A 3 st (1 extra, 3 km), B 3 st (1 extra, 5 km). B:s logg för 30 dagar sedan utanför.
  await db.query(
    `insert into logs (player_id, date, type, event_uid, mission_id, km) values
       ($1, ${TODAY},      'match',  'ev-2',   null, null),
       ($1, ${TODAY} - 1,  'extra',  null,     $3,   null),
       ($1, ${TODAY} - 1,  'weekly', null,     $4,   3),
       ($2, ${TODAY},      'extra',  null,     $3,   null),
       ($2, ${TODAY},      'weekly', null,     $4,   5),
       ($2, ${TODAY} - 3,  'match',  'ev-old', null, null),
       ($2, ${TODAY} - 30, 'weekly', null,     $4,   100)`,
    [A, B, M_DAILY, M_WEEKLY],
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
            ('ev-2', 'Cup', 'other', 'match', ${TODAY}, now(), now()),
            ('ev-3', 'Inställd', 'training', null, ${TODAY}, now(), now())`,
  );
  await db.query(`update calendar_events set cancelled = true where uid = 'ev-3'`);
  await db.query(
    `insert into calendar_events (uid, summary, kind, date) values ('ev-y', 'Igår', 'training', ${TODAY} - 1)`,
  );
  await db.query(`insert into settings (key, value) values ('ical_url', 'https://hemligt')`);
});

afterAll(async () => {
  await db?.end();
});

describe('logs', () => {
  it('A ser 0 av B:s loggar men sina egna', async () => {
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from logs where player_id = $1', [B])).toBe(0);
      expect(await count(c, 'select count(*) n from logs')).toBe(3);
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
        c.query(
          `insert into logs (player_id, date, type, mission_id, created_by) values ($1, ${TODAY}, 'extra', $3, $2)`,
          [A, COACH, M_DAILY],
        ),
      ),
    );
    expect(code).toBe('42501');
  });

  it('dubbel insert av samma (player_id, event_uid) ger unique_violation', async () => {
    const code = await as(A, async (c) => {
      await c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY}, 'training', 'ev-1')`, [A]);
      return sqlState(
        c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY}, 'training', 'ev-1')`, [A]),
      );
    });
    expect(code).toBe('23505');
  });

  it('flera extrapass samma dag går, men samma uppdrag bara en gång', async () => {
    const code = await as(A, async (c) => {
      await c.query('reset role');
      const { rows } = await c.query(
        `insert into missions (kind, name, active_from) values ('daily', 'Minipass', ${TODAY} - 1) returning id`,
      );
      const mini = rows[0].id as string;
      await switchTo(c, A);
      const extra = (mission: string) =>
        c.query(`insert into logs (player_id, date, type, mission_id) values ($1, ${TODAY}, 'extra', $2)`, [A, mission]);
      await extra(M_DAILY);
      await extra(mini);
      return sqlState(extra(mini));
    });
    expect(code).toBe('23505');
  });

  it('annan träning går bara en gång per dag', async () => {
    const code = await as(A, async (c) => {
      const other = (kind: string) =>
        c.query(`insert into logs (player_id, date, type, other_kind) values ($1, ${TODAY}, 'other_org', $2)`, [A, kind]);
      await other('fotboll');
      return sqlState(other('ovrigt'));
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
      expect(await count(c, 'select count(*) n from logs where player_id = $1', [B])).toBe(4);
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
      await c.query(
        `insert into logs (player_id, date, type, other_kind, created_by) values ($1, ${TODAY} - 5, 'other_org', 'fotboll', $1)`,
        [A],
      );
      await switchTo(c, A);
      await c.query(`insert into logs (player_id, date, type, other_kind) values ($1, ${TODAY}, 'other_org', 'fotboll')`, [A]);
      const old = await c.query(`delete from logs where player_id = $1 and date = ${TODAY} - 5`, [A]);
      const recent = await c.query(`delete from logs where player_id = $1 and type = 'other_org' and date = ${TODAY}`, [A]);
      expect(old.rowCount).toBe(0);
      expect(recent.rowCount).toBe(1);
    });
  });

  it('A kan inte radera en logg som tränaren skapat', async () => {
    await as(COACH, async (c) => {
      await c.query(`insert into logs (player_id, date, type, other_kind) values ($1, ${TODAY}, 'other_org', 'annat_lag')`, [A]);
      await switchTo(c, A);
      expect(await count(c, `select count(*) n from logs where created_by = $1`, [COACH])).toBe(1);
      expect((await c.query(`delete from logs where created_by = $1`, [COACH])).rowCount).toBe(0);
    });
  });

  it('tränaren ser alla loggar och kan skriva för spelare', async () => {
    await as(COACH, async (c) => {
      expect(await count(c, 'select count(*) n from logs')).toBe(7);
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

  it('tränaren sätter tröjnummer, spelaren kan inte ändra sitt eget', async () => {
    await as(COACH, async (c) => {
      expect((await c.query('update profiles set jersey_number = 17 where id = $1', [A])).rowCount).toBe(1);
      expect(await sqlState(c.query('update profiles set jersey_number = 100 where id = $1', [A]))).toBe('23514');
    });
    await as(A, async (c) => {
      expect((await c.query('update profiles set jersey_number = 9 where id = $1', [A])).rowCount).toBe(0);
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
      const r = await c.query(
        `insert into invites (display_name) values ('Ny') returning token, role, created_by, created_at`,
      );
      expect(r.rows[0].role).toBe('player');
      expect(r.rows[0].created_by).toBe(COACH);
      expect(r.rows[0].created_at).toBeInstanceOf(Date);
      // Tränaren kan ta bort en öppen inbjudan.
      expect((await c.query('delete from invites where token = $1', [r.rows[0].token])).rowCount).toBe(1);
    });
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from invites')).toBe(0);
    });
  });
});

describe('kalender, uppdrag och lagmål', () => {
  it('inloggad spelare kan läsa men inte skriva', async () => {
    await as(A, async (c) => {
      expect(await count(c, 'select count(*) n from calendar_events')).toBe(4);
      expect(await count(c, 'select count(*) n from missions')).toBe(3);
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
      const r = await c.query(`select uid, kind from calendar_events_effective where uid in ('ev-1', 'ev-2') order by uid`);
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

describe('logs: dataintegritet (constraints, prövas som tränare)', () => {
  const coachInsert = (cols: string, vals: string, params: unknown[]) =>
    as(COACH, (c) => sqlState(c.query(`insert into logs (${cols}) values (${vals})`, params)));

  it('veckouppdrag utan uppdrag avvisas', async () => {
    expect(await coachInsert('player_id, date, type, km', `$1, ${TODAY}, 'weekly', 5`, [A])).toBe('23514');
  });

  it('km över 100 avvisas', async () => {
    expect(
      await coachInsert('player_id, date, type, mission_id, km', `$1, ${TODAY}, 'weekly', $2, 99999`, [A, M_WEEKLY]),
    ).toBe('23514');
  });

  it('km på annat än veckouppdrag avvisas', async () => {
    expect(
      await coachInsert('player_id, date, type, event_uid, km', `$1, ${TODAY}, 'training', 'ev-1', 500`, [A]),
    ).toBe('23514');
    expect(await coachInsert('player_id, date, type, mission_id, km', `$1, ${TODAY}, 'extra', $2, 5`, [A, M_DAILY])).toBe(
      '23514',
    );
  });

  it('träning/match utan event_uid avvisas', async () => {
    expect(await coachInsert('player_id, date, type', `$1, ${TODAY}, 'training'`, [A])).toBe('23514');
    expect(await coachInsert('player_id, date, type', `$1, ${TODAY}, 'match'`, [A])).toBe('23514');
  });

  it('annan förening utan other_kind avvisas', async () => {
    expect(await coachInsert('player_id, date, type', `$1, ${TODAY}, 'other_org'`, [A])).toBe('23514');
  });

  it('okänt mission_id avvisas och uppdrag med loggar kan inte raderas', async () => {
    expect(
      await coachInsert('player_id, date, type, mission_id', `$1, ${TODAY}, 'extra', gen_random_uuid()`, [A]),
    ).toBe('23503');
    expect(await as(COACH, (c) => sqlState(c.query('delete from missions where id = $1', [M_WEEKLY])))).toBe('23503');
  });
});

describe('logs: spelarens insert kräver händelse eller aktivt uppdrag', () => {
  const playerInsert = (cols: string, vals: string, params: unknown[]) =>
    as(A, (c) => sqlState(c.query(`insert into logs (${cols}) values (${vals})`, params)));

  it('sondens fall avvisas: veckouppdrag 99999 km, utan uppdrag, träning utan händelse', async () => {
    expect(
      await playerInsert('player_id, date, type, mission_id, km', `$1, ${TODAY}, 'weekly', $2, 99999`, [A, M_WEEKLY]),
    ).toBe('23514');
    expect(await playerInsert('player_id, date, type, km', `$1, ${TODAY}, 'weekly', 5`, [A])).toBe('42501');
    expect(await playerInsert('player_id, date, type', `$1, ${TODAY}, 'training'`, [A])).toBe('42501');
  });

  it('giltiga loggar går igenom', async () => {
    await as(A, async (c) => {
      await c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY}, 'training', 'ev-1')`, [A]);
      await c.query(`insert into logs (player_id, date, type, event_uid) values ($1, ${TODAY} - 1, 'training', 'ev-y')`, [A]);
      await c.query(`insert into logs (player_id, date, type, mission_id) values ($1, ${TODAY}, 'extra', $2)`, [A, M_DAILY]);
      await c.query(
        `insert into logs (player_id, date, type, mission_id, km) values ($1, ${TODAY}, 'weekly', $2, 8)`,
        [A, M_WEEKLY],
      );
      expect(await count(c, 'select count(*) n from logs')).toBe(7);
    });
  });

  it('träning mot okänd, inställd, fel dags eller fel typs händelse avvisas', async () => {
    const ins = (type: string, uid: string, date: string) =>
      playerInsert('player_id, date, type, event_uid', `$1, ${date}, '${type}', $2`, [A, uid]);
    expect(await ins('training', 'finns-inte', TODAY)).toBe('42501');
    expect(await ins('training', 'ev-3', TODAY)).toBe('42501'); // inställd
    expect(await ins('training', 'ev-1', `${TODAY} - 1`)).toBe('42501'); // fel datum
    expect(await ins('match', 'ev-1', TODAY)).toBe('42501'); // fel typ
    expect(await ins('training', 'ev-2', TODAY)).toBe('42501'); // kind_override = match
  });

  it('extrapass/veckouppdrag mot fel sorts, inaktivt eller saknat uppdrag avvisas', async () => {
    const ins = (type: string, mission: string | null) =>
      playerInsert('player_id, date, type, mission_id', `$1, ${TODAY}, '${type}', $2`, [A, mission]);
    expect(await ins('extra', M_WEEKLY)).toBe('42501');
    expect(await ins('extra', M_OLD)).toBe('42501');
    expect(await ins('extra', null)).toBe('42501');
    expect(await ins('weekly', M_DAILY)).toBe('42501');
  });
});

describe('team_goal_total', () => {
  it('summerar både A:s och B:s loggar när A anropar', async () => {
    await as(A, async (c) => {
      const total = async (id: string) =>
        Number((await c.query('select team_goal_total($1) t', [id])).rows[0].t);
      expect(await total(GOAL_SESSIONS)).toBe(6);
      expect(await total(GOAL_EXTRA)).toBe(2);
      expect(await total(GOAL_KM)).toBe(8);
    });
  });

  it('anon kan inte anropa den', async () => {
    const code = await as(null, (c) => sqlState(c.query('select team_goal_total($1)', [GOAL_KM])));
    expect(code).toBe('42501');
  });

  it('räknar bara spelares loggar, inte tränarens egna (R12)', async () => {
    await as(A, async (c) => {
      await c.query('reset role');
      await c.query(
        `insert into logs (player_id, date, type, mission_id, km) values
           ($1, ${TODAY}, 'extra', $2, null), ($1, ${TODAY}, 'weekly', $3, 50)`,
        [COACH, M_DAILY, M_WEEKLY],
      );
      await switchTo(c, A);
      const total = async (id: string) =>
        Number((await c.query('select team_goal_total($1) t', [id])).rows[0].t);
      expect(await total(GOAL_SESSIONS)).toBe(6);
      expect(await total(GOAL_EXTRA)).toBe(2);
      expect(await total(GOAL_KM)).toBe(8);
    });
  });
});

describe('inloggad utan profil (främling som registrerat sig själv)', () => {
  it('is_member() är falskt för främlingen och sant för spelare och tränare', async () => {
    await as(STRANGER, async (c) => {
      expect((await c.query('select public.is_member() m')).rows[0].m).toBe(false);
    });
    await as(A, async (c) => {
      expect((await c.query('select public.is_member() m')).rows[0].m).toBe(true);
    });
    await as(COACH, async (c) => {
      expect((await c.query('select public.is_member() m')).rows[0].m).toBe(true);
    });
  });

  it('ser ingenting: kalender, vy, uppdrag, lagmål, profiler, loggar, inbjudningar, settings', async () => {
    await as(STRANGER, async (c) => {
      for (const table of [
        'calendar_events', 'calendar_events_effective', 'missions', 'team_goals',
        'profiles', 'logs', 'invites', 'settings', 'push_subscriptions',
      ]) {
        expect(await count(c, `select count(*) n from ${table}`), table).toBe(0);
      }
    });
  });

  it('team_goal_total ger ingenting', async () => {
    await as(STRANGER, async (c) => {
      for (const id of [GOAL_SESSIONS, GOAL_EXTRA, GOAL_KM]) {
        expect((await c.query('select team_goal_total($1) t', [id])).rows[0].t).toBeNull();
      }
    });
  });

  it('kan inte logga eller prenumerera på push', async () => {
    const codes = [
      await as(STRANGER, (c) =>
        sqlState(c.query(`insert into logs (player_id, date, type, other_kind) values ($1, ${TODAY}, 'other_org', 'ovrigt')`, [STRANGER])),
      ),
      await as(STRANGER, (c) =>
        sqlState(c.query(`insert into push_subscriptions (player_id, endpoint, p256dh, auth) values ($1, 'https://p/s', 'k', 's')`, [STRANGER])),
      ),
    ];
    // FK mot profiles (23503) eller RLS (42501): båda stoppar.
    for (const code of codes) expect(['23503', '42501']).toContain(code);
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
