'use client';

import { useState, useTransition } from 'react';
import { logWeekly, undoLog } from '@/app/(player)/actions';
import { parseKm } from '@/lib/actions/log-result';
import type { TodayView } from '@/lib/views/today';

const DAY_NAMES = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];

/** [6,7] blir "lör–sön", [1,3] blir "mån, ons", tomt betyder alla dagar. */
function weekdaysLabel(days: number[]): string | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 1) {
    return `${DAY_NAMES[sorted[0] - 1]}–${DAY_NAMES[sorted[sorted.length - 1] - 1]}`;
  }
  return sorted.map((d) => DAY_NAMES[d - 1]).join(', ');
}

const fmtKm = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });

export function WeeklyCard({
  date,
  weekly,
  weekdays,
}: {
  date: string;
  weekly: NonNullable<TodayView['weekly']>;
  weekdays: number[];
}) {
  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const days = weekdaysLabel(weekdays);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseKm(km);
    if (value === null) {
      setError('Ange km som ett tal större än 0 (högst 100), t.ex. 4,5.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await logWeekly(date, weekly.missionId, value);
      if (result.ok) setKm('');
      else setError(result.error);
    });
  }

  function undo(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await undoLog(id);
      if (!result.ok) setError(result.error);
    });
  }

  const status = weekly.complete
    ? '✓ klart!'
    : weekly.doneKm > 0
      ? `${fmtKm(weekly.doneKm)}${weekly.targetKm !== null ? ` / ${fmtKm(weekly.targetKm)}` : ''} km`
      : '○ inte gjort än';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">
          {weekly.name}
          {days && <span className="font-normal text-zinc-400"> ({days})</span>}
        </p>
        <p className={`shrink-0 text-sm font-bold ${weekly.complete ? 'text-gold' : 'text-zinc-400'}`}>{status}</p>
      </div>

      {weekly.todayLog ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>Loggat: {weekly.todayLog.km !== null ? `${fmtKm(weekly.todayLog.km)} km` : 'klart'}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => undo(weekly.todayLog!.id)}
            className="h-10 rounded-lg px-3 text-zinc-400 underline disabled:opacity-60"
          >
            Ångra
          </button>
        </div>
      ) : weekly.availableToday ? (
        <form onSubmit={submit} className="flex gap-2">
          <label className="sr-only" htmlFor="km">
            Antal km
          </label>
          <input
            id="km"
            inputMode="decimal"
            placeholder="km"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            className="h-12 w-24 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-lg outline-none focus:border-club"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-12 flex-1 rounded-xl bg-club font-display text-lg font-extrabold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {pending ? 'Sparar…' : 'Logga löpning'}
          </button>
        </form>
      ) : null}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
