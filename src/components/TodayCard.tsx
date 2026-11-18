'use client';

import { useRef, useState, useTransition } from 'react';
import { logEvent, logExtra, logOtherOrg, undoLog } from '@/app/(player)/actions';
import type { ActionResult } from '@/lib/actions/log-result';
import type { OtherOrgKind } from '@/lib/types';
import { nextCheckIn } from '@/lib/views/checkin';
import type { TodayView } from '@/lib/views/today';
import { CheckRow } from './CheckRow';

const OTHER_LABELS: Record<OtherOrgKind, string> = {
  annat_lag: 'Annat lag i klubben',
  fotboll: 'Fotboll',
  ovrigt: 'Övrigt',
};

type Props = Pick<TodayView, 'date' | 'events' | 'otherOrg' | 'extra'>;

export function TodayCard({ date, events, otherOrg, extra }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosingOther, setChoosingOther] = useState(false);
  const [, startTransition] = useTransition();
  const otherRef = useRef<HTMLDivElement>(null);
  const next = nextCheckIn({ events, otherOrg, extra });

  function run(key: string, action: () => Promise<ActionResult>) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      setBusy(null);
    });
  }

  /** Den stora knappen: checkar in nästa pass i listan, eller öppnar valet för annan träning. */
  function checkInNext() {
    if (!next) return;
    if (next.kind === 'event') run(next.uid, () => logEvent(next.uid));
    else if (next.kind === 'extra') run('extra', () => logExtra(date, next.missionId));
    else {
      setChoosingOther(true);
      requestAnimationFrame(() => otherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((e) => (
        <CheckRow
          key={e.uid}
          checked={e.checked}
          pending={busy === e.uid}
          badge="+1 pass"
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
          badge="+1 pass"
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
        <div ref={otherRef} className="rounded-2xl border border-club bg-zinc-900 p-3">
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

      {extra && (
        <CheckRow
          checked={extra.checked}
          emphasized={extra.emphasized}
          pending={busy === 'extra'}
          badge="+1 pass"
          onToggle={() => run('extra', () => (extra.logId ? undoLog(extra.logId) : logExtra(date, extra.missionId)))}
        >
          <span className="block font-semibold">
            Extrapass: {extra.name}{' '}
            {!extra.emphasized && !extra.checked && (
              <span className="text-sm font-normal text-zinc-400">(frivilligt idag)</span>
            )}
          </span>
          {extra.description && <span className="block text-sm text-zinc-400">{extra.description}</span>}
        </CheckRow>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {next && !choosingOther && (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background from-40% to-transparent px-4 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={checkInNext}
            disabled={busy !== null}
            className="mx-auto block h-16 w-full max-w-md rounded-2xl bg-club font-display text-[22px] leading-tight font-black tracking-wider text-white uppercase shadow-[0_6px_0_var(--color-club-deep),0_10px_30px_rgb(227_6_19/0.35)] transition-transform active:translate-y-1 active:shadow-[0_2px_0_var(--color-club-deep)] disabled:opacity-70"
          >
            {busy !== null ? 'Checkar in…' : 'Checka in passet'}
            <span className="block font-sans text-xs font-semibold tracking-normal normal-case opacity-85">{next.label}</span>
          </button>
        </div>
      )}
    </div>
  );
}
