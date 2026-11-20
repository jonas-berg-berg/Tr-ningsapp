'use client';

import { useState, useTransition } from 'react';
import { logEvent, logExtra, logOtherOrg, undoLog } from '@/app/(player)/actions';
import type { ActionResult } from '@/lib/actions/log-result';
import type { OtherOrgKind } from '@/lib/types';
import type { TodayView } from '@/lib/views/today';
import { CheckRow } from './CheckRow';

const OTHER_LABELS: Record<OtherOrgKind, string> = {
  annat_lag: 'Annat lag i klubben',
  fotboll: 'Fotboll',
  ovrigt: 'Övrigt',
};

type Props = Pick<TodayView, 'date' | 'events' | 'otherOrg' | 'extras'> & {
  /** Vad ett pass till ger, visas på rader som inte är ikryssade (t.ex. "+2 betyg 🔥"). */
  gain: string;
};

export function TodayCard({ date, events, otherOrg, extras, gain }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosingOther, setChoosingOther] = useState(false);
  const [, startTransition] = useTransition();

  function run(key: string, action: () => Promise<ActionResult>) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      setBusy(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((e) => (
        <CheckRow
          key={e.uid}
          checked={e.checked}
          pending={busy === e.uid}
          badge={e.checked ? '+1 pass' : gain}
          onToggle={() => run(e.uid, () => (e.logId ? undoLog(e.logId) : logEvent(e.uid)))}
        >
          <span className="block font-semibold">
            {e.kind === 'match' ? 'Jag spelade match' : 'Jag var på lagträningen'} {e.time}
          </span>
          <span className="block text-sm text-zinc-400">{e.title}</span>
        </CheckRow>
      ))}

      {otherOrg.checked || !choosingOther ? (
        <CheckRow
          checked={otherOrg.checked}
          pending={busy === 'other'}
          badge={otherOrg.checked ? '+1 pass' : gain}
          onToggle={() => {
            if (otherOrg.logId) run('other', () => undoLog(otherOrg.logId!));
            else setChoosingOther(true);
          }}
        >
          <span className="block font-semibold">
            {otherOrg.checked && otherOrg.kind ? `Annan träning: ${OTHER_LABELS[otherOrg.kind]}` : 'Annan träning'}
          </span>
          {!otherOrg.checked && <span className="block text-sm text-zinc-400">Fotboll, annat lag…</span>}
        </CheckRow>
      ) : (
        <div className="rounded-2xl border border-club bg-zinc-900 p-3">
          <p className="mb-2 px-1 font-semibold">Vilken träning?</p>
          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(OTHER_LABELS) as OtherOrgKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                disabled={busy === 'other'}
                onClick={() => {
                  setChoosingOther(false);
                  run('other', () => logOtherOrg(date, kind));
                }}
                className="h-12 rounded-xl bg-zinc-800 font-semibold disabled:opacity-60"
              >
                {OTHER_LABELS[kind]}
              </button>
            ))}
            <button type="button" onClick={() => setChoosingOther(false)} className="h-10 text-sm text-zinc-400">
              Avbryt
            </button>
          </div>
        </div>
      )}

      {extras.map((x) => (
        <CheckRow
          key={x.missionId}
          checked={x.checked}
          emphasized={x.emphasized}
          pending={busy === `extra:${x.missionId}`}
          badge={x.checked ? '+1 pass' : gain}
          onToggle={() =>
            run(`extra:${x.missionId}`, () => (x.logId ? undoLog(x.logId) : logExtra(date, x.missionId)))
          }
        >
          <span className="block font-semibold">
            Extrapass: {x.name}{' '}
            {!x.emphasized && !x.checked && (
              <span className="text-sm font-normal text-zinc-400">(frivilligt idag)</span>
            )}
          </span>
          {x.description && <span className="block text-sm text-zinc-400">{x.description}</span>}
        </CheckRow>
      ))}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
