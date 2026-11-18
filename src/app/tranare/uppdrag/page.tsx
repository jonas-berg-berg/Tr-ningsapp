import { Suspense } from 'react';
import { ActionForm } from '@/components/coach/ActionForm';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import { toMission } from '@/lib/supabase/rows';
import { createMission, endMission } from './actions';

const DAYS = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];
const input = 'h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-lime-400';
const fmtKm = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });

export default function MissionsPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Uppdrag</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Missions />
      </Suspense>
    </main>
  );
}

async function Missions() {
  const { supabase } = await requireCoachPage();
  const today = toStockholmDate(new Date());
  const { data, error } = await supabase.from('missions').select('*').order('active_from', { ascending: false });
  if (error) throw new Error(`Kunde inte läsa uppdragen: ${error.message}`);
  const missions = (data ?? []).map(toMission);

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Nytt uppdrag</h2>
        <ActionForm action={createMission} submitLabel="Skapa uppdrag">
          <fieldset className="flex gap-4 text-sm">
            <legend className="mb-1">Typ</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="daily" defaultChecked /> Dagligt extrapass
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="weekly" /> Veckouppdrag
            </label>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Namn
            <input name="name" required maxLength={80} placeholder="t.ex. Splits 3×10" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Beskrivning (frivillig)
            <input name="description" maxLength={300} placeholder="t.ex. Bulgarian splits 3×10 per ben" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Km-mål per vecka (bara veckouppdrag, frivilligt)
            <input name="target_km" inputMode="decimal" placeholder="t.ex. 8" className={input} />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Dagar (bara veckouppdrag, inga = alla dagar)</legend>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1">
                  <input type="checkbox" name="weekdays" value={i + 1} /> {d}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Gäller från
            <input type="date" name="active_from" required defaultValue={today} className={input} />
          </label>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Alla uppdrag</h2>
        {missions.length === 0 && <p className="text-sm text-zinc-400">Inga uppdrag än.</p>}
        <ul className="flex flex-col gap-3">
          {missions.map((m) => {
            const ended = m.activeTo !== null && m.activeTo < today;
            return (
              <li key={m.id} className="flex flex-col gap-2 rounded-2xl bg-zinc-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {m.name}{' '}
                    <span className="text-sm font-normal text-zinc-400">
                      ({m.kind === 'daily' ? 'extrapass' : 'veckouppdrag'}
                      {m.targetKm !== null && `, ${fmtKm(m.targetKm)} km`}
                      {m.weekdays.length > 0 && `, ${m.weekdays.map((d) => DAYS[d - 1]).join(' ')}`})
                    </span>
                  </p>
                  <span className={`shrink-0 text-xs font-bold ${ended ? 'text-zinc-500' : 'text-lime-400'}`}>
                    {ended ? 'Avslutat' : m.activeFrom > today ? 'Kommande' : 'Aktivt'}
                  </span>
                </div>
                {m.description && <p className="text-sm text-zinc-400">{m.description}</p>}
                <p className="text-xs text-zinc-400">
                  {m.activeFrom} – {m.activeTo ?? 'tills vidare'}
                </p>
                {!ended && (
                  <ActionForm action={endMission} submitLabel="Avsluta" variant="secondary" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <label className="flex flex-col gap-1 text-xs">
                      Sista dag
                      <input type="date" name="active_to" required defaultValue={m.activeTo ?? today} min={m.activeFrom} className={input} />
                    </label>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
