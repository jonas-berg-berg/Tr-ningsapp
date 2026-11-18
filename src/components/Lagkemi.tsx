import type { Tier, TeamCard } from '@/lib/card';
import { teamAverage, tierLabel } from '@/lib/card';
import type { TodayView } from '@/lib/views/today';
import { GoalMeter } from './GoalMeter';

const MAX_CARDS = 12;

const TIER_BG: Record<Tier, string> = {
  brons: 'bg-[linear-gradient(160deg,#e9ad74,#6b3f1d)] text-white',
  silver: 'bg-[linear-gradient(160deg,#fafafa,#868791)] text-zinc-900',
  guld: 'bg-[linear-gradient(160deg,#ffe596,#b7811c)] text-zinc-900',
  rod: 'bg-[linear-gradient(160deg,var(--color-club-hot),var(--color-club-deep))] text-white',
  ikon: 'bg-[linear-gradient(160deg,#3b3b42,#000)] text-gold',
};

/** Lagkemi: alla spelares minikort (bara betyg, inga namn) och lagets mål. */
export function Lagkemi({ cards, goals }: { cards: TeamCard[]; goals: TodayView['goals'] }) {
  if (cards.length === 0 && goals.length === 0) return null;
  const shown = cards.slice(0, MAX_CARDS);
  const hidden = cards.length - shown.length;
  // Mitt kort ska alltid synas, även om det inte är bland de högsta.
  const me = cards.find((c) => c.isMe);
  if (me && !shown.includes(me)) shown[shown.length - 1] = me;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4" aria-label="Lagkemi">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold">Lagkemi</h2>
          <p className="text-sm text-zinc-400">Alla kort i laget drar åt samma håll</p>
        </div>
        {cards.length > 0 && (
          <div className="text-right">
            <div className="font-display text-4xl leading-none font-black text-club-hot">{teamAverage(cards)}</div>
            <div className="text-xs text-zinc-400">lagets snitt</div>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <ul className="flex flex-wrap gap-y-2 pl-1.5" aria-label={`${cards.length} spelares betyg`}>
          {shown.map((c, i) => (
            <li
              key={i}
              className={`relative -ml-1.5 grid h-10 w-[30px] place-items-center rounded border-2 font-display text-[13px] font-black ${TIER_BG[c.tier]} ${
                c.isMe ? 'z-10 border-white' : 'border-zinc-900'
              }`}
              aria-label={`${c.isMe ? 'Du: ' : ''}betyg ${c.rating}, ${tierLabel(c.tier)}`}
            >
              {c.rating}
            </li>
          ))}
          {hidden > 0 && (
            <li className="-ml-1.5 grid h-10 w-[34px] place-items-center rounded border-2 border-zinc-900 bg-zinc-800 font-display text-[13px] font-black text-zinc-400">
              +{hidden}
            </li>
          )}
        </ul>
      )}

      {goals.map((g) => (
        <GoalMeter key={g.id} goal={g} />
      ))}
    </section>
  );
}
