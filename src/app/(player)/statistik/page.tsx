import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { MonthStats } from '@/components/MonthStats';
import { toStockholmDate } from '@/lib/dates';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { LOG_COLUMNS, toLog } from '@/lib/supabase/rows';
import { createClient } from '@/lib/supabase/server';
import { buildMonthStats, parseMonth } from '@/lib/views/stats';

export default function StatsPage({ searchParams }: PageProps<'/statistik'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="flex size-10 items-center justify-center rounded-lg bg-zinc-900" aria-label="Tillbaka">
          ‹
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Min statistik</h1>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsContent({ searchParams }: Pick<PageProps<'/statistik'>, 'searchParams'>) {
  const { manad } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = toStockholmDate(new Date());
  const month = parseMonth(manad, today);

  // Bara egna loggar: tränaren ser alla via RLS, så filtrera alltid på användaren.
  const rows = await fetchAll((from, to) =>
    supabase
      .from('logs')
      .select(LOG_COLUMNS)
      .eq('player_id', user.id)
      .order('date')
      .order('id')
      .range(from, to),
  );
  const stats = buildMonthStats(rows.map(toLog), month, today);

  return <MonthStats month={month} currentMonth={today.slice(0, 7)} stats={stats} basePath="/statistik" />;
}
