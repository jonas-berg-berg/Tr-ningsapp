import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Boosts } from '@/components/Boosts';
import { EnableNotifications } from '@/components/EnableNotifications';
import { InstallGuide } from '@/components/InstallGuide';
import { Lagkemi } from '@/components/Lagkemi';
import { LevelCounter } from '@/components/LevelCounter';
import { LogoutButton } from '@/components/LogoutButton';
import { NotMember } from '@/components/NotMember';
import { PlayerCard } from '@/components/PlayerCard';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';
import { StreakBadge } from '@/components/StreakBadge';
import { TodayCard } from '@/components/TodayCard';
import { WeeklyCard } from '@/components/WeeklyCard';
import { buildCardStats } from '@/lib/card';
import { addDays, stockholmHour, toStockholmDate } from '@/lib/dates';
import { nextLevel, passGain, recordNudges, streakAlert } from '@/lib/triggers';
import { createClient } from '@/lib/supabase/server';
import { buildTodayView } from '@/lib/views/today';
import { loadTodayData } from './data';
import { loadTeamCards } from './team';

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
    // '*' i stället för en kolumnlista: startsidan fungerar även innan 0003 (jersey_number) är körd.
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Kunde inte läsa profilen: ${profileError.message}`);
  // Inloggad men inte med i laget (t.ex. ett självregistrerat konto): RLS visar ändå inget.
  if (!profile) return <NotMember />;

  const now = toStockholmDate(new Date());
  const viewDate = yesterdayMode ? addDays(now, -1) : now;
  const [data, team] = await Promise.all([
    loadTodayData(supabase, user.id, viewDate),
    loadTeamCards(user.id, now).catch((e: unknown) => {
      // Lagkemin får aldrig stoppa startsidan (t.ex. om SUPABASE_SERVICE_ROLE_KEY saknas).
      console.error('Kunde inte läsa lagkemin', { message: e instanceof Error ? e.message : String(e) });
      return [];
    }),
  ]);
  const view = buildTodayView({ today: viewDate, now, ...data });
  // Kortet visar alltid läget idag, även i igår-läget.
  const card = buildCardStats(data.logs, now);
  // Triggers: vad nästa pass ger. Nivå och vinst räknas på dagen vyn visar.
  const level = nextLevel(data.logs, viewDate, now, card);
  const gain = passGain(data.logs, viewDate, now, card);
  const gainBadge = `${gain.rating > 0 ? `+${gain.rating} betyg` : '+1 pass'}${gain.streak ? ' 🔥' : ''}`;
  const alert = yesterdayMode ? null : streakAlert(data.logs, now, stockholmHour(new Date()));
  const nudges = recordNudges(data.logs, now).slice(0, 2);
  const jerseyNumber = typeof profile.jersey_number === 'number' ? profile.jersey_number : null;
  const weeklyDays = view.weekly ? (data.missions.find((m) => m.id === view.weekly!.missionId)?.weekdays ?? []) : [];

  const tab = (active: boolean) =>
    `flex h-10 flex-1 items-center justify-center rounded-lg font-display text-base font-extrabold tracking-wider uppercase ${
      active ? 'bg-club text-white' : 'text-zinc-400'
    }`;
  const heading = 'font-display text-[15px] font-extrabold tracking-[0.14em] text-zinc-400 uppercase';

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black tracking-wide uppercase">Hej {profile.display_name}!</h1>
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

      {/* Streakvarning och rekord först: det är det som ska locka till ett pass idag. */}
      <Boosts alert={alert} nudges={nudges} />

      <PlayerCard name={profile.display_name} jerseyNumber={jerseyNumber} stats={card} passesLeft={level?.passesLeft ?? null} />

      <nav className="flex gap-1 rounded-xl bg-zinc-900 p-1" aria-label="Välj dag">
        <Link href="/" className={tab(!yesterdayMode)} aria-current={!yesterdayMode ? 'page' : undefined}>
          Idag
        </Link>
        <Link href="/?dag=igar" className={tab(yesterdayMode)} aria-current={yesterdayMode ? 'page' : undefined}>
          Igår
        </Link>
      </nav>

      {/* Dagens pass är det man ska göra något med, så det får klubbens röda ram och sticker ut. */}
      <section
        aria-labelledby="dagens-pass"
        className="flex flex-col gap-3 rounded-3xl border-2 border-club bg-gradient-to-b from-club/25 via-club/10 to-zinc-950 p-4 shadow-[0_0_32px_rgb(227_6_19/0.25)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="dagens-pass" className="font-display text-2xl font-black tracking-wide text-white uppercase">
            {yesterdayMode ? 'Gårdagens pass' : 'Dagens pass'}
          </h2>
          <span className="font-display text-sm font-bold tracking-wider text-red-200 uppercase">
            {formatDay(view.date)}
          </span>
        </div>
        <LevelCounter tier={card.tier} next={level} />
        <TodayCard date={view.date} events={view.events} otherOrg={view.otherOrg} extras={view.extras} gain={gainBadge} />
        {view.frozenThisWeek && (
          <p className="text-xs text-sky-300">❄️ Veckans frysdag är använd – missa inte en dag till.</p>
        )}
      </section>

      {view.weekly && (
        <section className="flex flex-col gap-3">
          <h2 className={heading}>Denna vecka</h2>
          <WeeklyCard date={view.date} weekly={view.weekly} weekdays={weeklyDays} />
        </section>
      )}

      <Lagkemi cards={team} goals={view.goals} />

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
