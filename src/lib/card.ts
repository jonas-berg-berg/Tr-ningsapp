import { addDays } from './dates';
import { activeDates } from './logging';
import { dayStreak, longestStreak } from './streaks';
import type { ISODate, LogEntry } from './types';

/**
 * Spelarkortet: siffrorna och totalbetyget.
 *
 * Betyget är snittet av tre delar, var och en på skalan 0–99:
 * pass senaste 28 dagarna, pass senaste 7 dagarna och längsta streaken.
 * Det finns inget hårt tak: varje pass ger alltid mer, men tillskottet halveras
 * för varje "halveringssteg" (HALF), så delen närmar sig 99 utan att nå över.
 * Snittet sträcks sedan ut till 40–99, så att ingen har ett tvåsiffrigt lågt betyg.
 */

export const HALF = { last28: 10, last7: 3, longest: 20 } as const;

export type Tier = 'brons' | 'silver' | 'guld' | 'rod' | 'ikon';

/** Nivåerna i ordning med lägsta betyg för varje nivå. */
export const TIERS: { tier: Tier; label: string; min: number }[] = [
  { tier: 'brons', label: 'Brons', min: 0 },
  { tier: 'silver', label: 'Silver', min: 55 },
  { tier: 'guld', label: 'Guld', min: 70 },
  { tier: 'rod', label: 'Röd', min: 80 },
  { tier: 'ikon', label: 'Ikon', min: 90 },
];

export interface CardStats {
  total: number;
  last28: number;
  last7: number;
  currentStreak: number;
  longestStreak: number;
  /** Om spelaren har loggat något idag (flamman lyser). */
  activeToday: boolean;
  /** Delpoängen 0–99, avrundade för visning. */
  parts: { last28: number; last7: number; longest: number };
  rating: number;
  tier: Tier;
  next: { tier: Tier; pointsLeft: number } | null;
}

/** En del av betyget: 0 vid 0, 49,5 vid `half`, närmar sig 99. */
export function partScore(value: number, half: number): number {
  if (value <= 0) return 0;
  return 99 * (1 - Math.pow(0.5, value / half));
}

/** Totalbetyget 40–99 från delpoängen (0–99 vardera). */
export function ratingFromParts(parts: number[]): number {
  const avg = parts.reduce((sum, p) => sum + p / 99, 0) / parts.length;
  return Math.round(40 + 59 * avg);
}

export function tierForRating(rating: number): Tier {
  let current: Tier = 'brons';
  for (const t of TIERS) if (rating >= t.min) current = t.tier;
  return current;
}

export function tierLabel(tier: Tier): string {
  return TIERS.find((t) => t.tier === tier)!.label;
}

export function buildCardStats(logs: LogEntry[], today: ISODate): CardStats {
  const past = logs.filter((l) => l.date <= today);
  const from28 = addDays(today, -27);
  const from7 = addDays(today, -6);
  const last28 = past.filter((l) => l.date >= from28).length;
  const last7 = past.filter((l) => l.date >= from7).length;

  const active = activeDates(past);
  const currentStreak = dayStreak(active, today).current;
  const longest = Math.max(longestStreak(active), currentStreak);

  const raw = [partScore(last28, HALF.last28), partScore(last7, HALF.last7), partScore(longest, HALF.longest)];
  const rating = ratingFromParts(raw);
  const tier = tierForRating(rating);
  const nextIndex = TIERS.findIndex((t) => t.tier === tier) + 1;
  const nextTier = TIERS[nextIndex];

  return {
    total: past.length,
    last28,
    last7,
    currentStreak,
    longestStreak: longest,
    activeToday: active.has(today),
    parts: { last28: Math.round(raw[0]), last7: Math.round(raw[1]), longest: Math.round(raw[2]) },
    rating,
    tier,
    next: nextTier ? { tier: nextTier.tier, pointsLeft: nextTier.min - rating } : null,
  };
}
