import Link from 'next/link';
import { Suspense } from 'react';
import { ActionForm } from '@/components/coach/ActionForm';
import { CopyLink } from '@/components/coach/CopyButton';
import { requireCoachPage } from '@/lib/auth/require-coach';
import { INVITE_VALID_DAYS, isInviteExpired } from '@/lib/invites';
import { requestOrigin } from '@/lib/origin-server';
import { loadPlayers } from '../data';
import { createInvite, deleteInvite, removePlayer } from './actions';

const input = 'h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 outline-none focus:border-club';

export default function PlayersPage({ searchParams }: PageProps<'/tranare/spelare'>) {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Spelare och tränare</h1>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-busy="true" />}>
        <Players searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Players({ searchParams }: Pick<PageProps<'/tranare/spelare'>, 'searchParams'>) {
  const { supabase, userId } = await requireCoachPage();
  const { 'ta-bort': removeId } = await searchParams;

  const [people, invites, origin] = await Promise.all([
    loadPlayers(supabase),
    supabase.from('invites').select('token, display_name, role, created_at').is('used_at', null).order('display_name'),
    requestOrigin(),
  ]);
  if (invites.error) throw new Error(`Kunde inte läsa inbjudningar: ${invites.error.message}`);
  const now = new Date();
  const toRemove = people.find((p) => p.id === removeId && p.role === 'player' && p.id !== userId);

  return (
    <>
      {toRemove && (
        <section className="flex flex-col gap-3 rounded-2xl border border-red-500/60 bg-red-500/10 p-4">
          <h2 className="font-bold">Ta bort {toRemove.name}?</h2>
          <p className="text-sm">
            Kontot ({toRemove.username}) tas bort för gott. All spelarens loggar tas bort. Det sänker också
            lagmålens summor.
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <ActionForm action={removePlayer} submitLabel="Ja, ta bort" pendingLabel="Tar bort…" variant="danger">
              <input type="hidden" name="id" value={toRemove.id} />
            </ActionForm>
            <Link href="/tranare/spelare" className="flex h-11 items-center rounded-xl bg-zinc-800 px-4 font-semibold">
              Avbryt
            </Link>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-zinc-900 p-4">
        <h2 className="font-bold">Bjud in</h2>
        <ActionForm action={createInvite} submitLabel="Skapa inbjudan" pendingLabel="Skapar…">
          <label className="flex flex-col gap-1 text-sm">
            Förnamn
            <input name="display_name" required maxLength={40} className={input} autoComplete="off" />
          </label>
          <fieldset className="flex gap-4 text-sm">
            <legend className="sr-only">Roll</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="player" defaultChecked /> Spelare
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="role" value="coach" /> Tränare
            </label>
          </fieldset>
        </ActionForm>
      </section>

      {(invites.data ?? []).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Inbjudningar som inte använts</h2>
          <p className="text-sm text-zinc-400">En länk gäller i {INVITE_VALID_DAYS} dagar.</p>
          <ul className="flex flex-col gap-3">
            {(invites.data ?? []).map((i) => {
              const expired = isInviteExpired(i.created_at as string, now);
              return (
                <li key={i.token as string} className="flex flex-col gap-2 rounded-2xl bg-zinc-900 p-3">
                  <span className="font-semibold">
                    {i.display_name as string}{' '}
                    <span className="text-sm font-normal text-zinc-400">({i.role === 'coach' ? 'tränare' : 'spelare'})</span>
                    {expired && <span className="text-sm font-normal text-red-400"> · har gått ut, skapa en ny</span>}
                  </span>
                  {!expired && <CopyLink link={`${origin}/invite/${i.token as string}`} />}
                  <ActionForm action={deleteInvite} submitLabel="Ta bort inbjudan" pendingLabel="Tar bort…" variant="secondary" className="flex items-center gap-2">
                    <input type="hidden" name="token" value={i.token as string} />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Konton</h2>
        <ul className="flex flex-col divide-y divide-zinc-800 rounded-2xl bg-zinc-900">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                {p.role === 'player' ? (
                  <Link href={`/tranare/spelare/${p.id}`} className="font-semibold underline">
                    {p.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{p.name}</span>
                )}{' '}
                <span className="text-sm text-zinc-400">
                  {p.username} · {p.role === 'coach' ? 'tränare' : 'spelare'}
                </span>
              </span>
              {p.role === 'player' && (
                <Link href={`/tranare/spelare?ta-bort=${p.id}`} className="text-sm text-red-400 underline">
                  Ta bort
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
