'use client';

import type { ReactNode } from 'react';

/** En stor kryssrad. Tryck kryssar i, tryck igen ångrar. */
export function CheckRow({
  checked,
  pending,
  emphasized = false,
  onToggle,
  children,
}: {
  checked: boolean;
  pending: boolean;
  emphasized?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={pending}
      onClick={onToggle}
      className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
        checked
          ? 'border-lime-400 bg-lime-400/10'
          : emphasized
            ? 'border-amber-400/70 bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900'
      }`}
    >
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-black ${
          checked ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-600'
        }`}
      >
        {pending ? '…' : checked ? '✓' : ''}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
