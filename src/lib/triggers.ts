import { buildCardStats, RATING_FLOOR, TIERS, tierLabel, type CardStats, type Tier } from './card';
import { addDays, isoWeekKey } from './dates';
import { activeDates } from './logging';
import { dayStreak, historicStreaks } from './streaks';
import type { ISODate, LogEntry } from './types';

/**
 * Triggers på startsidan: små puffar som visar vad nästa pass ger.
 * Allt räknas fram ur spelarens egna loggar, inget sparas.
 */

/** Jämna passantal som firas. */
export const MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
/** Fler pass än så till nästa nivå visas som betyg i stället. */
const MAX_SIMULATED = 30;
/** Klockslag (Stockholm) då streakvarningen blir skarp. */
export const STREAK_ALERT_HOUR = 17;

function withPasses(logs: LogEntry[], date: ISODate, n: number): LogEntry[] {
  const extra: LogEntry[] = Array.from({ length: n }, (_, i) => ({
    id: `sim-${i}`, playerId: '', date, type: 'extra', eventUid: null, otherKind: null, missionId: null, km: null,
  }));
  return [...logs, ...extra];
}

export interface NextLevel {
  tier: Tier;
  label: string;
  /** Pass på `date` som behövs för nivån, eller null om det är fler än MAX_SIMULATED. */
  passesLeft: number | null;
  pointsLeft: number;
  /** 0–1: hur långt man har kommit från nuvarande nivå till nästa. */
  progress: number;
}

/** Hur många pass (loggade på `date`) som behövs till nästa nivå. */
export function nextLevel(logs: LogEntry[], date: ISODate, now: ISODate, stats: CardStats): NextLevel | null {
  if (!stats.next) return null;
  const min = TIERS.find((t) => t.tier === stats.next!.tier)!.min;
  // Betyget börjar på 40 (RATING_FLOOR), så Brons-mätaren startar där och inte på 0.
  const from = Math.max(RATING_FLOOR, TIERS.find((t) => t.tier === stats.tier)!.min);
  let passesLeft: number | null = null;
  for (let n = 1; n <= MAX_SIMULATED; n++) {
    if (buildCardStats(withPasses(logs, date, n), now).rating >= min) {
      passesLeft = n;
      break;
    }
  }
  return {
    tier: stats.next.tier,
    label: tierLabel(stats.next.tier),
    passesLeft,
    pointsLeft: stats.next.pointsLeft,
    progress: Math.min(1, Math.max(0, (stats.rating - from) / (min - from))),
  };
}

/** Vad ett pass till på `date` ger: betyg och om streaken växer. */
export function passGain(logs: LogEntry[], date: ISODate, now: ISODate, stats: CardStats) {
  const after = buildCardStats(withPasses(logs, date, 1), now);
  return { rating: after.rating - stats.rating, streak: after.currentStreak > stats.currentStreak };
}

export interface StreakAlert {
  /** urgent: streaken tar slut vid midnatt. freeze: frysdagen går åt. hint: en vänlig puff tidigare på dagen. */
  level: 'urgent' | 'freeze' | 'hint';
  streak: number;
}

/** Varning när spelaren inte har loggat idag och har en streak att förlora. */
export function streakAlert(logs: LogEntry[], now: ISODate, hour: number): StreakAlert | null {
  const active = activeDates(logs.filter((l) => l.date <= now));
  if (active.has(now)) return null;
  const streak = dayStreak(active, now).current;
  if (streak === 0) return null;
  if (hour < STREAK_ALERT_HOUR) return streak >= 2 ? { level: 'hint', streak } : null;
  // Imorgon räknas idag som missad. Är streaken lika lång då har frysdagen räddat den;
  // annars bryts den (en kortare bit kan finnas kvar, men den gamla streaken är borta).
  const survives = dayStreak(active, addDays(now, 1)).current >= streak;
  return { level: survives ? 'freeze' : 'urgent', streak };
}

export interface Nudge {
  icon: string;
  text: string;
  /** Firande (något är redan uppnått) i stället för en puff framåt. */
  celebrate: boolean;
}

const dagar = (n: number) => (n === 1 ? 'dag' : 'dagar');

/**
 * Puffar mot egna rekord: streakrekord, jämna passantal och bästa veckan.
 * Sorterade med den närmaste först (ett pass bort slår ett firande).
 */
export function recordNudges(logs: LogEntry[], now: ISODate): Nudge[] {
  const past = logs.filter((l) => l.date <= now);
  const active = activeDates(past);
  const activeToday = active.has(now);
  const ranked: { rank: number; nudge: Nudge }[] = [];

  // Streakrekord: jämför med tidigare streaks, inte med den pågående.
  const current = dayStreak(active, now).current;
  if (current > 0) {
    const lastActive = [...active].sort().at(-1)!;
    const prevBest = historicStreaks(active)
      .filter((s) => s.end < lastActive)
      .reduce((max, s) => Math.max(max, s.current), 0);
    if (prevBest >= 3) {
      const toBeat = prevBest + 1 - current;
      if (toBeat <= 0) {
        ranked.push({ rank: 4, nudge: { icon: '🏆', text: `Nytt streakrekord: ${current} dagar!`, celebrate: true } });
      } else if (toBeat === 1 && !activeToday) {
        ranked.push({ rank: 1, nudge: { icon: '🏆', text: `Ett pass idag slår ditt streakrekord på ${prevBest} dagar!`, celebrate: false } });
      } else if (toBeat === 1) {
        ranked.push({ rank: 5, nudge: { icon: '🏆', text: `Träna imorgon så slår du ditt streakrekord på ${prevBest} dagar`, celebrate: false } });
      } else if (toBeat <= 3) {
        ranked.push({ rank: 6, nudge: { icon: '🏆', text: `${toBeat} ${dagar(toBeat)} kvar till nytt streakrekord (${prevBest} dagar)`, celebrate: false } });
      }
    }
  }

  // Jämna passantal.
  const total = past.length;
  const next = MILESTONES.find((m) => m > total);
  if (MILESTONES.includes(total) && past.some((l) => l.date === now)) {
    ranked.push({ rank: 3, nudge: { icon: '🎉', text: `Pass nummer ${total} avklarat!`, celebrate: true } });
  } else if (next !== undefined && next - total === 1) {
    ranked.push({ rank: 2, nudge: { icon: '🎯', text: `Nästa pass blir ditt ${next}:e!`, celebrate: false } });
  } else if (next !== undefined && next - total === 2) {
    ranked.push({ rank: 6, nudge: { icon: '🎯', text: `2 pass kvar till pass nummer ${next}`, celebrate: false } });
  }

  // Bästa veckan hittills (bara tidigare veckor räknas som rekord).
  const thisWeek = isoWeekKey(now);
  const perWeek = new Map<string, number>();
  for (const l of past) perWeek.set(isoWeekKey(l.date), (perWeek.get(isoWeekKey(l.date)) ?? 0) + 1);
  const bestWeek = Math.max(0, ...[...perWeek].filter(([w]) => w < thisWeek).map(([, n]) => n));
  const week = perWeek.get(thisWeek) ?? 0;
  if (bestWeek >= 3) {
    if (week > bestWeek) {
      ranked.push({ rank: 4, nudge: { icon: '💪', text: `Din bästa vecka hittills: ${week} pass!`, celebrate: true } });
    } else if (week === bestWeek) {
      ranked.push({ rank: 2, nudge: { icon: '💪', text: `Ett pass till så är det din bästa vecka hittills`, celebrate: false } });
    } else if (bestWeek - week === 1) {
      ranked.push({ rank: 6, nudge: { icon: '💪', text: `2 pass till så slår du din bästa vecka (${bestWeek} pass)`, celebrate: false } });
    }
  }

  return ranked.sort((a, b) => a.rank - b.rank).map((r) => r.nudge);
}
