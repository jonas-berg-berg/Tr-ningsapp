import type { TodayView } from '@/lib/views/today';

type Goal = TodayView['goals'][number];

const JOURNEY_KM = 450; // Lerum → Stockholm, 45 mil

const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

export function GoalMeter({ goal }: { goal: Goal }) {
  const share = goal.target > 0 ? Math.min(goal.total / goal.target, 1) : 0;
  const pct = `${(share * 100).toFixed(1)}%`;
  const left = Math.max(goal.target - goal.total, 0);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="font-semibold">Lagmål: {goal.name}</p>

      {goal.metric === 'km' ? (
        <div>
          <div className="relative mx-2 mt-2 mb-1 h-6" role="img" aria-label={`Resan Lerum till Stockholm: ${fmt(share * JOURNEY_KM)} av ${JOURNEY_KM} km`}>
            <div className="absolute inset-x-0 top-1/2 h-0 -translate-y-1/2 border-t-2 border-dashed border-zinc-600" />
            <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded bg-lime-400" style={{ width: pct }} />
            <div
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 bg-lime-400 shadow"
              style={{ left: pct }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Lerum</span>
            <span>Stockholm</span>
          </div>
          <p className="mt-2 text-sm">
            {fmt(goal.total)} / {fmt(goal.target)} km
            <span className="text-zinc-400"> · {fmt(share * JOURNEY_KM)} av 45 mil på vägen</span>
          </p>
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
            <div className="h-full rounded-full bg-lime-400" style={{ width: pct }} />
          </div>
          <p className="mt-2 text-sm">
            {fmt(goal.total)} / {fmt(goal.target)}
            <span className="text-zinc-400"> · {left > 0 ? `${fmt(left)} kvar` : 'Klart!'}</span>
          </p>
        </div>
      )}

      {goal.reward && <p className="text-sm font-semibold text-amber-300">🏆 {goal.reward}</p>}
    </div>
  );
}
