import type { Nudge, StreakAlert } from '@/lib/triggers';

const dagar = (n: number) => (n === 1 ? 'dag' : 'dagar');

/** Streakvarning och rekordpuffar högst upp på startsidan. */
export function Boosts({ alert, nudges }: { alert: StreakAlert | null; nudges: Nudge[] }) {
  if (!alert && nudges.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {alert && <StreakAlertBanner alert={alert} />}
      {nudges.map((n) => (
        <p
          key={n.text}
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-display text-lg leading-tight font-extrabold tracking-wide uppercase ${
            n.celebrate
              ? 'border-gold bg-gradient-to-r from-gold/30 to-zinc-900 text-white'
              : 'border-gold/60 bg-gradient-to-r from-gold/15 to-zinc-900 text-gold'
          }`}
        >
          <span aria-hidden className="text-2xl">
            {n.icon}
          </span>
          {n.text}
        </p>
      ))}
    </div>
  );
}

function StreakAlertBanner({ alert }: { alert: StreakAlert }) {
  const { level, streak } = alert;
  if (level === 'urgent') {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-2xl border-2 border-club-hot bg-club px-4 py-3 shadow-[0_0_28px_rgb(227_6_19/0.55)] motion-safe:animate-pulse">
        <span aria-hidden className="text-3xl">🔥</span>
        <p className="leading-tight">
          <span className="block font-display text-xl font-black tracking-wide uppercase">
            Streaken på {streak} {dagar(streak)} dör vid midnatt
          </span>
          <span className="text-sm text-red-100">Ingen frysdag kvar. Ett pass idag räddar den.</span>
        </p>
      </div>
    );
  }
  if (level === 'freeze') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-sky-400 bg-sky-950 px-4 py-3">
        <span aria-hidden className="text-3xl">❄️</span>
        <p className="leading-tight">
          <span className="block font-display text-xl font-black tracking-wide uppercase">Logga idag och spara frysdagen</span>
          <span className="text-sm text-sky-200">
            Annars går veckans frysdag åt för din streak på {streak} {dagar(streak)}.
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-orange-400/60 bg-gradient-to-r from-orange-500/20 to-zinc-900 px-4 py-3">
      <span aria-hidden className="text-3xl">🔥</span>
      <p className="font-display text-lg leading-tight font-extrabold tracking-wide uppercase">
        Ett pass idag så blir streaken {streak + 1} {dagar(streak + 1)}
      </p>
    </div>
  );
}
