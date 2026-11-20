'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { TIERS, tierLabel, type Tier } from '@/lib/card';
import type { NextLevel } from '@/lib/triggers';

const TIER_COLOR: Record<Tier, string> = {
  brons: '#e0975a',
  silver: '#d4dae3',
  guld: '#f2c14e',
  rod: '#ff2d3d',
  ikon: '#ffffff',
};
const STORAGE_KEY = 'senast-sedd-niva';

function readSeen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Ingen lagring (privat läge): inget firande, resten fungerar.
  }
}
const noopSubscribe = () => () => {};

/**
 * "2 PASS TILL GULD": hur många pass som är kvar till nästa nivå. När spelaren
 * når en ny nivå visas ett firande en gång (senast sedda nivån sparas i webbläsaren).
 */
export function LevelCounter({ tier, next }: { tier: Tier; next: NextLevel | null }) {
  const seen = useSyncExternalStore(noopSubscribe, readSeen, () => null);
  const [dismissed, setDismissed] = useState(false);
  const seenIndex = TIERS.findIndex((t) => t.tier === seen);
  const levelUp = !dismissed && seenIndex !== -1 && TIERS.findIndex((t) => t.tier === tier) > seenIndex;

  // Spara nivån efter visningen, så att firandet bara kommer en gång per ny nivå.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {
      // Se readSeen.
    }
  }, [tier]);

  return (
    <div className="flex flex-col gap-2">
      {levelUp && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-2xl border-2 px-4 py-3 text-center motion-safe:animate-bounce"
          style={{ borderColor: TIER_COLOR[tier], boxShadow: `0 0 32px ${TIER_COLOR[tier]}66` }}
        >
          <span className="block font-display text-2xl font-black tracking-wide uppercase" style={{ color: TIER_COLOR[tier] }}>
            ⭐ Uppgraderad till {tierLabel(tier)}!
          </span>
          <span className="text-xs text-zinc-400">Tryck för att stänga</span>
        </button>
      )}

      {next && (
        <div className="rounded-2xl bg-zinc-950/70 px-4 py-3">
          <p className="flex items-baseline gap-2 font-display font-black tracking-wide uppercase">
            {next.passesLeft !== null ? (
              <>
                <span className="text-5xl leading-none" style={{ color: TIER_COLOR[next.tier] }}>
                  {next.passesLeft}
                </span>
                <span className="text-2xl leading-none">
                  pass till{' '}
                  <span style={{ color: TIER_COLOR[next.tier] }}>{next.label}</span>
                </span>
              </>
            ) : (
              <span className="text-2xl leading-none">
                {next.pointsLeft} betyg till <span style={{ color: TIER_COLOR[next.tier] }}>{next.label}</span>
              </span>
            )}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(4, next.progress * 100)}%`, background: TIER_COLOR[next.tier] }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-400">
            {next.passesLeft === 1 ? 'Ett pass till idag så uppgraderas ditt kort!' : 'Varje pass du kryssar i här räknas.'}
          </p>
        </div>
      )}
    </div>
  );
}
