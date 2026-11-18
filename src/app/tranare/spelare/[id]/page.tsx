import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MonthStats } from '@/components/MonthStats';
import { ActionForm } from '@/components/coach/ActionForm';
import { isISODate, UUID_RE } from '@/lib/actions/form-state';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import { toMission } from '@/lib/supabase/rows';
import type { LogType, Mission, OtherOrgKind } from '@/lib/types';
import { buildMonthStats, parseMonth, shiftMonth } from '@/lib/views/stats';
import { loadLogs } from '../../data';
import { addLog, deleteLog, setJerseyNumber, setPlayerPassword } from './actions';

const TYPE_LABELS: Record<LogType, string> = {
  training: 'Lagträning',
  match: 'Match',
  other_org: 'Annan träning',
  extra: 'Extrapass',
  weekly: 'Veckouppdrag',
};
const OTHER_LABELS: Record<OtherOrgKind, string> = {
  annat_lag: 'Annat lag i klubben',
  fotboll: 'Fotboll',
  ovrigt: 'Övrigt',
};

const timeFmt = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' });
const fmtKm = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
const activeOn = (m: Mission, date: string) => m.activeFrom <= date && (m.activeTo === null || m.activeTo >= date);
const input = 'h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-lime-400';

export default function CoachPlayerPage({ params, searchParams }: PageProps<'/tranare/spelare/[id]'>) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
      <PlayerDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlayerDetail({ params, searchParams }: PageProps<'/tranare/spelare/[id]'>) {
  const { supabase } = await requireCoachPage();
  const { id } = await params;
  const { manad, datum } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const today = toStockholmDate(new Date());
  const month = parseMonth(manad, today);
  const date = typeof datum === 'string' && isISODate(datum) && datum <= today ? datum : today;

  const [profile, logs, logRows, missions, events] = await Promise.all([
    supabase.from('profiles').select('display_name, username, jersey_number').eq('id', id).maybeSingle(),
    loadLogs(supabase, id),
    // Månadens loggar med händelsetitel, för listan.
    supabase
      .from('logs')
      .select('id, date, type, event_title, other_kind, mission_id, km')
      .eq('player_id', id)
      .gte('date', `${month}-01`)
      .lt('date', `${shiftMonth(month, 1)}-01`)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('missions').select('*').order('active_from', { ascending: false }),
    supabase
      .from('calendar_events_effective')
      .select('uid, summary, kind, starts_at, cancelled')
      .eq('date', date)
      .in('kind', ['training', 'match'])
      .order('starts_at'),
  ]);
  const firstError = profile.error ?? logRows.error ?? missions.error ?? events.error;
  if (firstError) throw new Error(`Kunde inte läsa spelarens data: ${firstError.message}`);
  if (!profile.data) notFound();

  const name = profile.data.display_name as string;
  const missionList = (missions.data ?? []).map(toMission);
  const missionName = new Map(missionList.map((m) => [m.id, m.name]));
  const stats = buildMonthStats(logs, month, today);
  const daily = missionList.filter((m) => m.kind === 'daily' && activeOn(m, date));
  const weekly = missionList.filter((m) => m.kind === 'weekly' && activeOn(m, date));
  const basePath = `/tranare/spelare/${id}`;

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/tranare" className="flex size-10 items-center justify-center rounded-lg bg-zinc-900" aria-label="Tillbaka">
          ‹
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{name}</h1>
      </header>

      <div className="max-w-md">
        <MonthStats month={month} currentMonth={today.slice(0, 7)} stats={stats} basePath={basePath} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Loggar i månaden</h2>
        {(logRows.data ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">Inga loggar.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
            {(logRows.data ?? []).map((l) => {
              const type = l.type as LogType;
              const detail =
                type === 'training' || type === 'match'
                  ? (l.event_title as string | null)
                  : type === 'other_org'
                    ? OTHER_LABELS[l.other_kind as OtherOrgKind]
                    : missionName.get(l.mission_id as string);
              return (
                <li key={l.id as string} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-sm">
                    <span className="font-semibold">{l.date as string}</span> · {TYPE_LABELS[type]}
                    {detail && <span className="text-zinc-400"> · {detail}</span>}
                    {l.km !== null && <span className="text-zinc-400"> · {fmtKm(Number(l.km))} km</span>}
                  </span>
                  <ActionForm action={deleteLog} submitLabel="Ta bort" pendingLabel="…" variant="secondary" className="flex items-center gap-2">
                    <input type="hidden" name="id" value={l.id as string} />
                    <input type="hidden" name="player_id" value={id} />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Lägg till pass</h2>
        <form method="get" action={basePath} className="flex items-end gap-2">
          <input type="hidden" name="manad" value={month} />
          <label className="flex flex-col gap-1 text-sm">
            Datum
            <input type="date" name="datum" defaultValue={date} max={today} className={input} />
          </label>
          <button type="submit" className="h-11 rounded-xl bg-zinc-800 px-4 font-semibold">
            Visa dagen
          </button>
        </form>

        <ActionForm action={addLog} submitLabel={`Lägg till för ${date}`}>
          <input type="hidden" name="player_id" value={id} />
          <input type="hidden" name="date" value={date} />
          <label className="flex flex-col gap-1 text-sm">
            Vad
            <select name="what" required defaultValue="" className={input}>
              <option value="" disabled>
                Välj…
              </option>
              {(events.data ?? []).length > 0 && (
                <optgroup label="Kalendern">
                  {(events.data ?? []).map((e) => (
                    <option key={e.uid as string} value={`event:${e.uid as string}`}>
                      {e.kind === 'match' ? 'Match' : 'Lagträning'} {timeFmt.format(new Date(e.starts_at as string))}{' '}
                      {e.summary as string}
                      {e.cancelled ? ' (inställd)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Annan träning">
                {(Object.keys(OTHER_LABELS) as OtherOrgKind[]).map((k) => (
                  <option key={k} value={`other:${k}`}>
                    {OTHER_LABELS[k]}
                  </option>
                ))}
              </optgroup>
              {daily.length > 0 && (
                <optgroup label="Extrapass">
                  {daily.map((m) => (
                    <option key={m.id} value={`extra:${m.id}`}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {weekly.length > 0 && (
                <optgroup label="Veckouppdrag">
                  {weekly.map((m) => (
                    <option key={m.id} value={`weekly:${m.id}`}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {weekly.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              Km (bara veckouppdrag)
              <input name="km" inputMode="decimal" placeholder="t.ex. 4,5" className={input} />
            </label>
          )}
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Tröjnummer</h2>
        <p className="text-sm text-zinc-400">Visas stort på {name}s spelarkort. Lämna tomt för att ta bort.</p>
        <ActionForm action={setJerseyNumber} submitLabel="Spara nummer" pendingLabel="Sparar…" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="player_id" value={id} />
          <label className="flex flex-col gap-1 text-sm">
            Nummer (0–99)
            <input
              name="jersey_number"
              inputMode="numeric"
              pattern="[0-9]{0,2}"
              maxLength={2}
              defaultValue={(profile.data.jersey_number as number | null) ?? ''}
              className={`${input} w-24`}
            />
          </label>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Nytt lösenord</h2>
        <p className="text-sm text-zinc-400">
          Har {name} glömt lösenordet? Sätt ett nytt här och berätta det för spelaren. Användarnamnet är{' '}
          <span className="font-semibold text-zinc-100">{profile.data.username as string}</span>. Loggarna finns kvar.
        </p>
        <ActionForm action={setPlayerPassword} submitLabel="Spara nytt lösenord" pendingLabel="Sparar…">
          <input type="hidden" name="player_id" value={id} />
          <label className="flex flex-col gap-1 text-sm">
            Nytt lösenord (minst 8 tecken)
            <input name="password" type="text" required minLength={8} maxLength={72} autoComplete="off" className={input} />
          </label>
        </ActionForm>
      </section>
    </main>
  );
}
