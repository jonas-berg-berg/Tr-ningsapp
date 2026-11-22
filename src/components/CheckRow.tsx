'use client';

import type { ReactNode } from 'react';

/**
 * En stor kryssrad. Tryck kryssar i, tryck igen ångrar.
 * `title` delar rad med `badge` (t.ex. "+2 betyg 🔥"); `detail` får hela bredden under.
 */
export function CheckRow({
  checked,
  pending,
  emphasized = false,
  badge,
  title,
  detail,
  onToggle,
}: {
  checked: boolean;
  pending: boolean;
  emphasized?: boolean;
  badge?: string;
  title: ReactNode;
  detail?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={pending}
      onClick={onToggle}
      className={`flex min-h-16 w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-[background-color,transform] active:scale-[0.98] disabled:opacity-60 ${
        checked ? 'bg-club/25' : 'bg-zinc-900 hover:bg-zinc-800'
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg font-black ${
          checked ? 'border-club bg-club text-white' : emphasized ? 'border-gold' : 'border-zinc-600'
        }`}
      >
        {pending ? '…' : checked ? '✓' : ''}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-start justify-between gap-2">
          <span className="pt-1 leading-snug font-semibold">{title}</span>
          {badge && (
            <span
              className={`mt-0.5 shrink-0 rounded-md px-2 py-1 font-display text-sm leading-none font-extrabold whitespace-nowrap ${
                checked ? 'bg-zinc-950/40 text-red-100' : 'bg-gold text-zinc-950'
              }`}
            >
              {badge}
            </span>
          )}
        </span>
        {detail && <span className="text-sm leading-snug text-zinc-400">{detail}</span>}
      </span>
    </button>
  );
}
