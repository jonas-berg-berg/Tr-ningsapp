import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { EnableNotifications } from '@/components/EnableNotifications';
import { GoalMeter } from '@/components/GoalMeter';
import { InstallGuide } from '@/components/InstallGuide';
import { LogoutButton } from '@/components/LogoutButton';
import { NotMember } from '@/components/NotMember';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';
import { StreakBadge } from '@/components/StreakBadge';
import { TodayCard } from '@/components/TodayCard';
import { WeeklyCard } from '@/components/WeeklyCard';
import { addDays, toStockholmDate } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { buildTodayView } from '@/lib/views/today';
import { loadTodayData } from './data';

const dayLabel = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function formatDay(date: string): string {
  return dayLabel.format(new Date(`${date}T12:00:00Z`)).replace(/\.$/, '');
}

// Med cacheComponents måste data per förfrågan (cookies, searchParams) ligga inom <Suspense>.
export default function PlayerHome({ searchParams }: PageProps<'/'>) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <PlayerHomeContent searchParams={searchParams} />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6" aria-busy="true">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-900" />
      <div className="h-12 animate-pulse rounded-xl bg-zinc-900" />
      <div className="h-16 animate-pulse rounded-2xl bg-zinc-900" />
      <div className="h-16 animate-pulse rounded-2xl bg-zinc-900" />
    </main>
  );
}

async function PlayerHomeContent({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { dag } = await searchParams;
  const yesterdayMode = dag === 'igar';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Kunde inte läsa profilen: ${profileError.message}`);
  // Inloggad men inte med i laget (t.ex. ett självregistrerat konto): RLS visar ändå inget.
  if (!profile) return <NotMember />;

  const now = toStockholmDate(new Date());
  const viewDate = yesterdayMode ? addDays(now, -1) : now;
  const data = await loadTodayData(supabase, user.id, viewDate);
  const view = buildTodayView({ today: viewDate, now, ...data });
  const weeklyDays = view.weekly ? (data.missions.find((m) => m.id === view.weekly!.missionId)?.weekdays ?? []) : [];

  const tab = (active: boolean) =>
    `flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-bold ${
      active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400'
    }`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Hej {profile.display_name}!</h1>
        <div className="flex gap-2">
          <StreakBadge
            icon="🔥"
            value={view.dayStreak}
            unit={view.dayStreak === 1 ? 'dag' : 'dagar'}
            hint={view.frozenThisWeek ? 'Veckans frysdag är använd' : undefined}
          />
          <StreakBadge icon="📅" value={view.weekStreak} unit={view.weekStreak === 1 ? 'vecka' : 'veckor'} />
        </div>
      </header>

      <nav className="flex gap-1 rounded-xl bg-zinc-900 p-1" aria-label="Välj dag">
        <Link href="/" className={tab(!yesterdayMode)} aria-current={!yesterdayMode ? 'page' : undefined}>
          Idag
        </Link>
        <Link href="/?dag=igar" className={tab(yesterdayMode)} aria-current={yesterdayMode ? 'page' : undefined}>
          Igår
        </Link>
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          {yesterdayMode ? 'Igår' : 'Idag'} – {formatDay(view.date)}
        </h2>
        <TodayCard date={view.date} events={view.events} otherOrg={view.otherOrg} extra={view.extra} />
        {view.frozenThisWeek && (
          <p className="text-xs text-sky-300">❄️ Veckans frysdag är använd – missa inte en dag till.</p>
        )}
      </section>

      {view.weekly && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Denna vecka</h2>
          <WeeklyCard date={view.date} weekly={view.weekly} weekdays={weeklyDays} />
        </section>
      )}

      {view.goals.length > 0 && (
        <section className="flex flex-col gap-3">
          {view.goals.map((g) => (
            <GoalMeter key={g.id} goal={g} />
          ))}
        </section>
      )}

      <RegisterServiceWorker />
      <InstallGuide />
      <EnableNotifications />

      <nav className="flex flex-col gap-2" aria-label="Mer">
        <Link href="/statistik" className="flex h-12 items-center justify-between rounded-xl bg-zinc-900 px-4 font-semibold">
          Min statistik <span aria-hidden>›</span>
        </Link>
        {profile.role === 'coach' && (
          <Link href="/tranare" className="flex h-12 items-center justify-between rounded-xl bg-zinc-900 px-4 font-semibold">
            Tränarvy <span aria-hidden>›</span>
          </Link>
        )}
      </nav>

      <div className="flex justify-center">
        <LogoutButton />
      </div>
    </main>
  );
}
