'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { isISODate } from '@/lib/actions/form-state';

/**
 * Datumväljare för "Lägg till pass". Byter dag direkt vid ändring, så att
 * dagens kalenderhändelser och datumet som skickas med passet alltid är det
 * valda. Månaden följer med, så att det nya passet syns i månadslistan.
 */
export function DayPicker({
  basePath,
  date,
  today,
  className,
}: {
  basePath: string;
  date: string;
  today: string;
  className: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Spärr mot halvskrivna år (t.ex. 0002-11-15) när man skriver datumet för hand.
  const min = `${Number(today.slice(0, 4)) - 1}-01-01`;

  function go(value: string) {
    if (!isISODate(value) || value < min || value > today || value === date) return;
    const params = new URLSearchParams({ manad: value.slice(0, 7), datum: value });
    startTransition(() => router.replace(`${basePath}?${params}`, { scroll: false }));
  }

  return (
    <form method="get" action={basePath} className="flex flex-col gap-1 text-sm">
      <input type="hidden" name="manad" value={date.slice(0, 7)} />
      <label className="flex flex-col gap-1">
        Datum
        <input
          type="date"
          name="datum"
          defaultValue={date}
          min={min}
          max={today}
          onChange={(e) => go(e.target.value)}
          className={className}
        />
      </label>
      <span aria-live="polite" className="text-xs text-zinc-400">
        {pending ? 'Hämtar dagen…' : ''}
      </span>
    </form>
  );
}
