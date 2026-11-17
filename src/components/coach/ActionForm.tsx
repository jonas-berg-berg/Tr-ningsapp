'use client';

import { useActionState, type ReactNode } from 'react';
import type { FormState } from '@/lib/actions/form-state';
import { CopyLink } from './CopyButton';

/** Formulär mot en server action, med väntläge och svensk återkoppling. */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Sparar…',
  variant = 'primary',
  className = 'flex flex-col gap-3',
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const button = {
    primary: 'h-11 rounded-xl bg-lime-400 px-4 font-bold text-zinc-950',
    secondary: 'h-10 rounded-lg bg-zinc-800 px-3 text-sm font-semibold',
    danger: 'h-11 rounded-xl bg-red-500 px-4 font-bold text-white',
  }[variant];

  return (
    <form action={formAction} className={className}>
      {children}
      <button type="submit" disabled={pending} className={`${button} disabled:opacity-60`}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm text-lime-400">
          {state.ok}
        </p>
      )}
      {state?.link && <CopyLink link={state.link} />}
    </form>
  );
}
