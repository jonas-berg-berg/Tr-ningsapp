'use client';

import { useActionState } from 'react';
import { redeemInvite } from './actions';

const inputClass =
  'h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-lg outline-none focus:border-lime-400';

export function InviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(redeemInvite.bind(null, token), undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Välj användarnamn</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          minLength={3}
          maxLength={20}
          required
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">3–20 tecken: bokstäver, siffror, punkt, - eller _</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Välj lösenord</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
        <span className="text-xs text-zinc-500">Minst 8 tecken</span>
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-xl bg-lime-400 text-lg font-bold text-zinc-950 disabled:opacity-60"
      >
        {pending ? 'Skapar konto…' : 'Skapa konto'}
      </button>
    </form>
  );
}
