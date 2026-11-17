import { Suspense } from 'react';
import { ActionForm } from '@/components/coach/ActionForm';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import type { EventKind } from '@/lib/types';
import { setKindOverride } from './actions';

const KIND_LABELS: Record<EventKind, string> = { training: 'Träning', match: 'Match', other: 'Övrigt' };
const when = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Stockholm',
});

export default function CalendarPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Kalender</h1>
      <p className="text-sm text-zinc-400">
        Typen sätts automatiskt från Sportadmin. Ändra den om en händelse blivit fel klassad, t.ex. en
        träning som ska räknas.
      </p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Events />
      </Suspense>
    </main>
  );
}

async function Events() {
  const { supabase } = await requireCoachPage();
  const today = toStockholmDate(new Date());
  const { data, error } = await supabase
    .from('calendar_events')
    .select('uid, summary, kind, kind_override, starts_at, location, cancelled')
    .gte('date', today)
    .order('starts_at')
    .limit(100);
  if (error) throw new Error(`Kunde inte läsa kalendern: ${error.message}`);
  const events = data ?? [];

  if (events.length === 0) {
    return <p className="text-sm text-zinc-400">Inga kommande händelser. Synka under Inställningar.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e) => {
        const auto = KIND_LABELS[(e.kind as EventKind) ?? 'other'];
        const effective = (e.kind_override ?? e.kind) as EventKind;
        return (
          <li key={e.uid as string} className={`flex flex-col gap-2 rounded-2xl bg-zinc-900 p-4 ${e.cancelled ? 'opacity-60' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">
                {(e.summary as string | null) ?? '(utan titel)'}
                {e.cancelled && <span className="text-sm font-normal text-red-400"> · inställd</span>}
              </p>
              <span className="shrink-0 text-xs font-bold text-zinc-400">{KIND_LABELS[effective]}</span>
            </div>
            <p className="text-xs capitalize text-zinc-400">
              {when.format(new Date(e.starts_at as string))}
              {e.location ? ` · ${e.location as string}` : ''}
            </p>
            <ActionForm action={setKindOverride} submitLabel="Spara" variant="secondary" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="uid" value={e.uid as string} />
              <label className="sr-only" htmlFor={`kind-${e.uid as string}`}>
                Typ
              </label>
              <select
                id={`kind-${e.uid as string}`}
                name="kind_override"
                defaultValue={(e.kind_override as string | null) ?? ''}
                className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-sm"
              >
                <option value="">Automatiskt ({auto})</option>
                <option value="training">Träning</option>
                <option value="match">Match</option>
                <option value="other">Övrigt (räknas inte)</option>
              </select>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
