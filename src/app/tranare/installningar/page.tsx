import { Suspense } from 'react';
import { ActionForm } from '@/components/coach/ActionForm';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { maskUrl } from '@/lib/sportadmin/url';
import { saveSportadminUrl, syncNow } from './actions';

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Inställningar</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const { supabase } = await requireCoachPage();
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'sportadmin_url').maybeSingle();
  if (error) throw new Error(`Kunde inte läsa inställningarna: ${error.message}`);
  const current = (data?.value as string | null | undefined)?.trim() || null;
  // Bara den maskerade varianten lämnar servern.
  const masked = current ? maskUrl(current) : null;

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Sportadmin-kalendern</h2>
        <p className="text-sm">
          Nuvarande länk:{' '}
          {masked ? <code className="break-all text-zinc-300">{masked}</code> : <span className="text-amber-300">ingen inställd</span>}
        </p>
        <ActionForm action={saveSportadminUrl} submitLabel="Spara länk">
          <label className="flex flex-col gap-1 text-sm">
            Ny länk (lämna tomt för att behålla nuvarande)
            <input
              name="url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://portalweb.sportadmin.se/webcal?id=…"
              className="h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-lime-400"
            />
          </label>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Synka kalendern</h2>
        <p className="text-sm text-zinc-400">Kalendern synkas automatiskt varje timme. Synka nu om något just ändrats.</p>
        <ActionForm action={syncNow} submitLabel="Synka nu" pendingLabel="Synkar…" />
      </section>
    </>
  );
}
