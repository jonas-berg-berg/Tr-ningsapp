import { Suspense } from 'react';
import { ActionForm } from '@/components/coach/ActionForm';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { toStockholmDate } from '@/lib/dates';
import { toGoal } from '@/lib/supabase/rows';
import type { TeamGoal } from '@/lib/types';
import { createGoal, updateGoalDates } from './actions';

const METRIC_LABELS: Record<TeamGoal['metric'], string> = {
  sessions: 'Antal pass (alla typer)',
  extra: 'Antal extrapass',
  km: 'Löpta km',
};
const input = 'h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-lime-400';
const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

export default function GoalsPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Lagmål</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Goals />
      </Suspense>
    </main>
  );
}

async function Goals() {
  const { supabase } = await requireCoachPage();
  const today = toStockholmDate(new Date());
  const { data, error } = await supabase.from('team_goals').select('*').order('starts_on', { ascending: false });
  if (error) throw new Error(`Kunde inte läsa lagmålen: ${error.message}`);
  const goals = (data ?? []).map(toGoal);
  const totals = await Promise.all(
    goals.map(async (g) => {
      const { data: total, error: rpcError } = await supabase.rpc('team_goal_total', { goal_id: g.id });
      if (rpcError) console.error('team_goal_total misslyckades', { goalId: g.id, code: rpcError.code });
      return rpcError ? null : Number(total ?? 0);
    }),
  );

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Nytt lagmål</h2>
        <ActionForm action={createGoal} submitLabel="Skapa lagmål">
          <label className="flex flex-col gap-1 text-sm">
            Namn
            <input name="name" required maxLength={80} placeholder="t.ex. 200 pass före jul" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Vad räknas
            <select name="metric" required className={input} defaultValue="sessions">
              {(Object.keys(METRIC_LABELS) as TeamGoal['metric'][]).map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Målvärde
            <input name="target" required inputMode="decimal" placeholder="t.ex. 200" className={input} />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Från
              <input type="date" name="starts_on" required defaultValue={today} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Till och med
              <input type="date" name="ends_on" required className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Belöning (frivillig)
            <input name="reward" maxLength={120} placeholder="t.ex. Pizza efter träningen" className={input} />
          </label>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Alla lagmål</h2>
        {goals.length === 0 && <p className="text-sm text-zinc-400">Inga lagmål än.</p>}
        <ul className="flex flex-col gap-3">
          {goals.map((g, i) => {
            const ended = g.endsOn < today;
            const total = totals[i];
            return (
              <li key={g.id} className="flex flex-col gap-2 rounded-2xl bg-zinc-900 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{g.name}</p>
                  <span className={`shrink-0 text-xs font-bold ${ended ? 'text-zinc-500' : 'text-lime-400'}`}>
                    {ended ? 'Avslutat' : g.startsOn > today ? 'Kommande' : 'Pågår'}
                  </span>
                </div>
                <p className="text-sm">
                  {METRIC_LABELS[g.metric]}: {total === null ? 'kunde inte räknas' : fmt(total)} / {fmt(g.target)}
                  {g.metric === 'km' ? ' km' : ''}
                </p>
                <p className="text-xs text-zinc-400">
                  {g.startsOn} – {g.endsOn}
                  {g.reward && ` · 🏆 ${g.reward}`}
                </p>
                <p className="text-xs text-zinc-400">
                  Bara pass från och med första dag räknas. Flytta första dag bakåt om fler pass ska räknas.
                </p>
                <ActionForm
                  action={updateGoalDates}
                  submitLabel="Spara datum"
                  variant="secondary"
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={g.id} />
                  <label className="flex flex-col gap-1 text-xs">
                    Första dag
                    <input type="date" name="starts_on" required defaultValue={g.startsOn} className={input} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Sista dag
                    <input type="date" name="ends_on" required defaultValue={g.endsOn} className={input} />
                  </label>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
