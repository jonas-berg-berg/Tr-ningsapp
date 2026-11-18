import Link from 'next/link';
import { Suspense } from 'react';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import {
  buildCoachOverview,
  COACH_SORT_KEYS,
  sortCoachOverview,
  type CoachSortKey,
  type SortDir,
} from '@/lib/views/coach';
import { loadLogs, loadPlayers } from './data';

const COLUMNS: { key: CoachSortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Spelare', numeric: false },
  { key: 'today', label: 'Idag', numeric: true },
  { key: 'streak', label: 'Streak', numeric: true },
  { key: 'active7', label: '7 dagar', numeric: true },
  { key: 'active30', label: '30 dagar', numeric: true },
];

export default function CoachOverviewPage({ searchParams }: PageProps<'/tranare'>) {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-black tracking-tight">Översikt</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Overview({ searchParams }: Pick<PageProps<'/tranare'>, 'searchParams'>) {
  const { supabase } = await requireCoachPage();
  const params = await searchParams;
  const key = COACH_SORT_KEYS.includes(params.sort as CoachSortKey) ? (params.sort as CoachSortKey) : 'name';
  const dir: SortDir = params.dir === 'desc' ? 'desc' : params.dir === 'asc' ? 'asc' : key === 'name' ? 'asc' : 'desc';

  const today = toStockholmDate(new Date());
  const [players, logs] = await Promise.all([loadPlayers(supabase), loadLogs(supabase)]);
  const byPlayer = new Map<string, typeof logs>();
  for (const l of logs) {
    const list = byPlayer.get(l.playerId);
    if (list) list.push(l);
    else byPlayer.set(l.playerId, [l]);
  }

  const rows = sortCoachOverview(
    buildCoachOverview(
      players.filter((p) => p.role === 'player').map((p) => ({ id: p.id, name: p.name, logs: byPlayer.get(p.id) ?? [] })),
      today,
    ),
    key,
    dir,
  );

  if (rows.length === 0) {
    return (
      <p className="text-zinc-400">
        Inga spelare än. <Link href="/tranare/spelare" className="underline">Bjud in spelare</Link>.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 text-left">
          <tr>
            {COLUMNS.map((c) => {
              const active = c.key === key;
              const nextDir: SortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : c.numeric ? 'desc' : 'asc';
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-3 py-2 ${c.numeric ? 'text-right' : ''}`}
                >
                  <Link href={`/tranare?sort=${c.key}&dir=${nextDir}`} className="font-bold">
                    {c.label}
                    {active && <span aria-hidden>{dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800">
              <td className="px-3 py-2">
                <Link href={`/tranare/spelare/${r.id}`} className="font-semibold underline">
                  {r.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-right">{r.activeToday ? '✓' : '–'}</td>
              <td className="px-3 py-2 text-right">🔥 {r.dayStreak}</td>
              <td className="px-3 py-2 text-right">{r.active7}</td>
              <td className="px-3 py-2 text-right">{r.active30}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
