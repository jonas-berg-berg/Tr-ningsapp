'use client';

import type { ReactNode } from 'react';

/** En stor kryssrad. Tryck kryssar i, tryck igen ångrar. `badge` visas till höger (t.ex. "+1 pass"). */
export function CheckRow({
  checked,
  pending,
  emphasized = false,
  badge,
  onToggle,
  children,
}: {
  checked: boolean;
  pending: boolean;
  emphasized?: boolean;
  badge?: string;
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
          ? 'border-club bg-gradient-to-r from-club/20 to-zinc-900 to-70%'
          : emphasized
            ? 'border-gold/70 bg-zinc-900'
            : 'border-zinc-800 bg-zinc-900'
      }`}
    >
      <span
        aria-hidden
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-black ${
          checked ? 'border-club bg-club text-white' : 'border-zinc-600'
        }`}
      >
        {pending ? '…' : checked ? '✓' : ''}
      </span>
      <span className="flex-1">{children}</span>
      {badge && (
        <span
          className={`shrink-0 rounded-md px-2 py-1 font-display text-sm font-extrabold whitespace-nowrap ${
            checked ? 'bg-gold text-zinc-950' : 'bg-gold/10 text-gold'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
