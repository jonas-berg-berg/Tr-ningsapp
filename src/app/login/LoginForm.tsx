'use client';

import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Användarnamn</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-lg outline-none focus:border-club"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Lösenord</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-lg outline-none focus:border-club"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-xl bg-club text-lg font-bold text-white disabled:opacity-60"
      >
        {pending ? 'Loggar in…' : 'Logga in'}
      </button>
    </form>
  );
}
