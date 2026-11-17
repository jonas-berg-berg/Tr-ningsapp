import Link from 'next/link';
import type { LogType } from '@/lib/types';
import { shiftMonth, type MonthStats as Stats } from '@/lib/views/stats';

const TYPE_LABELS: Record<LogType, string> = {
  training: 'Lagträning',
  match: 'Match',
  other_org: 'Annan träning',
  extra: 'Extrapass',
  weekly: 'Veckouppdrag',
};

const WEEKDAYS = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];

const monthLabel = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtKm = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

/**
 * Månadskalender och siffror. Samma komponent för spelarens egen sida och
 * tränarens spelarvy. Månadslänkarna blir `${basePath}?manad=YYYY-MM`.
 */
export function MonthStats({
  month,
  currentMonth,
  stats,
  basePath,
}: {
  month: string;
  currentMonth: string;
  stats: Stats;
  basePath: string;
}) {
  const first = stats.days[0].date;
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7; // mån = 0
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const title = monthLabel.format(new Date(`${first}T12:00:00Z`));
  const sessions = Object.values(stats.countsByType).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href={`${basePath}?manad=${prev}`} className="flex size-10 items-center justify-center rounded-lg bg-zinc-900" aria-label="Föregående månad">
          ‹
        </Link>
        <h2 className="text-lg font-bold capitalize">{title}</h2>
        {month < currentMonth ? (
          <Link href={`${basePath}?manad=${next}`} className="flex size-10 items-center justify-center rounded-lg bg-zinc-900" aria-label="Nästa månad">
            ›
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 font-semibold text-zinc-400">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {stats.days.map((d) => (
          <div
            key={d.date}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg ${
              d.active ? 'bg-lime-400/15' : d.frozen ? 'bg-sky-400/15' : 'bg-zinc-900'
            }`}
            aria-label={`${Number(d.date.slice(8))}${d.active ? ', aktiv' : d.frozen ? ', frysdag' : ''}`}
          >
            <span className="text-zinc-400">{Number(d.date.slice(8))}</span>
            <span aria-hidden className="text-base leading-none">
              {d.active ? '🔥' : d.frozen ? '❄️' : ''}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-400">🔥 aktiv dag · ❄️ frysdag</p>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900 p-4">
          <dt className="text-xs font-bold uppercase tracking-widest text-zinc-400">Längsta streak</dt>
          <dd className="text-2xl font-black">
            {stats.longestStreak} {stats.longestStreak === 1 ? 'dag' : 'dagar'}
          </dd>
        </div>
        <div className="rounded-2xl bg-zinc-900 p-4">
          <dt className="text-xs font-bold uppercase tracking-widest text-zinc-400">Löpta km</dt>
          <dd className="text-2xl font-black">{fmtKm(stats.totalKm)} km</dd>
        </div>
      </dl>

      <div className="rounded-2xl bg-zinc-900 p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Pass i månaden ({sessions})</p>
        <ul className="flex flex-col gap-1">
          {(Object.keys(TYPE_LABELS) as LogType[]).map((t) => (
            <li key={t} className="flex justify-between">
              <span>{TYPE_LABELS[t]}</span>
              <span className="font-bold">{stats.countsByType[t]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
