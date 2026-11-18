import type { TodayView } from '@/lib/views/today';

type Goal = TodayView['goals'][number];

const JOURNEY_KM = 450; // Lerum → Stockholm, 45 mil

const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

export function GoalMeter({ goal }: { goal: Goal }) {
  const share = goal.target > 0 ? Math.min(goal.total / goal.target, 1) : 0;
  const pct = `${(share * 100).toFixed(1)}%`;
  const left = Math.max(goal.target - goal.total, 0);
  const unit = goal.metric === 'km' ? ' km' : '';
  const remaining = left > 0 ? `kvar: ${fmt(left)}${unit}` : 'Klart!';

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">Lagmål: {goal.name}</p>
        <span className="font-display text-2xl font-black text-club-hot">{Math.round(share * 100)}%</span>
      </div>

      {goal.metric === 'km' ? (
        <div>
          <div className="relative mx-2 mt-2 mb-1 h-6" role="img" aria-label={`Resan Lerum till Stockholm: ${fmt(share * JOURNEY_KM)} av ${JOURNEY_KM} km`}>
            <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-zinc-800" />
            <div className="absolute left-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-club-deep to-club-hot" style={{ width: pct }} />
            <div
              className="absolute top-1/2 size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-club bg-zinc-100 shadow"
              style={{ left: pct }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Lerum</span>
            <span>Stockholm</span>
          </div>
          <p className="mt-2 text-sm">
            {fmt(goal.total)} / {fmt(goal.target)} km
            <span className="text-zinc-400"> · {remaining}</span>
          </p>
          <p className="text-xs text-zinc-400">{fmt((share * JOURNEY_KM) / 10)} av 45 mil på vägen</p>
        </div>
      ) : (
        <div>
          <div
            className="h-4 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goal.target}
            aria-valuenow={goal.total}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-club-deep to-club-hot" style={{ width: pct }} />
          </div>
          <p className="mt-2 text-sm">
            {fmt(goal.total)} / {fmt(goal.target)}
            <span className="text-zinc-400"> · {remaining}</span>
          </p>
        </div>
      )}

      {goal.reward && <p className="text-sm font-semibold text-gold">🏆 Belöning: {goal.reward}</p>}
    </div>
  );
}
