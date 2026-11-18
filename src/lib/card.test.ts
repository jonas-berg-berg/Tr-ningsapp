import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { buildCardStats, partScore, ratingFromParts, teamAverage, teamCards, tierForRating } from './card';
import type { ISODate, LogEntry } from './types';

const TODAY = '2026-11-18';

function log(date: ISODate, i = 0): LogEntry {
  return { id: `${date}-${i}`, playerId: 'p', date, type: 'extra', eventUid: null, otherKind: null, missionId: 'm', km: null };
}

/** En logg per dag, n dagar bakåt som slutar `end`. */
function daily(n: number, end: ISODate = TODAY): LogEntry[] {
  return Array.from({ length: n }, (_, i) => log(addDays(end, -i)));
}

describe('partScore', () => {
  it('är 0 utan pass och halva skalan vid halveringsvärdet', () => {
    expect(partScore(0, 10)).toBe(0);
    expect(partScore(10, 10)).toBeCloseTo(49.5);
  });
  it('har inget hårt tak: fler pass ger alltid mer, men aldrig över 99', () => {
    expect(partScore(41, 10)).toBeGreaterThan(partScore(40, 10));
    expect(partScore(1000, 10)).toBeLessThanOrEqual(99);
  });
});

describe('ratingFromParts', () => {
  it('går från 40 till 99', () => {
    expect(ratingFromParts([0, 0, 0])).toBe(40);
    expect(ratingFromParts([99, 99, 99])).toBe(99);
  });
});

describe('tierForRating', () => {
  it('delar in betyget i fem nivåer', () => {
    expect(tierForRating(40)).toBe('brons');
    expect(tierForRating(54)).toBe('brons');
    expect(tierForRating(55)).toBe('silver');
    expect(tierForRating(70)).toBe('guld');
    expect(tierForRating(80)).toBe('rod');
    expect(tierForRating(90)).toBe('ikon');
  });
});

describe('buildCardStats', () => {
  it('ger lägsta betyget och brons utan loggar', () => {
    const s = buildCardStats([], TODAY);
    expect(s).toMatchObject({ total: 0, last28: 0, last7: 0, currentStreak: 0, longestStreak: 0, rating: 40, tier: 'brons' });
    expect(s.next).toEqual({ tier: 'silver', pointsLeft: 15 });
  });

  it('räknar varje logg som ett pass och fönstren inklusive idag', () => {
    const logs = [log(TODAY, 0), log(TODAY, 1), log(addDays(TODAY, -6)), log(addDays(TODAY, -7)), log(addDays(TODAY, -27)), log(addDays(TODAY, -28))];
    const s = buildCardStats(logs, TODAY);
    expect(s.total).toBe(6);
    expect(s.last7).toBe(3);
    expect(s.last28).toBe(5);
  });

  it('räknar inte loggar efter dagens datum', () => {
    const s = buildCardStats([log(addDays(TODAY, 1))], TODAY);
    expect(s.total).toBe(0);
  });

  it('har pågående och rekordstreak, och rekordet är minst lika långt som pågående', () => {
    const old = daily(30, addDays(TODAY, -60));
    const s = buildCardStats([...old, ...daily(5)], TODAY);
    expect(s.currentStreak).toBe(5);
    expect(s.longestStreak).toBe(30);
    expect(s.activeToday).toBe(true);
  });

  it('räknar exemplet från designen: 14 pass på 4 v, 3 på 7 d, rekord 34 ger 76 och guld', () => {
    expect(ratingFromParts([partScore(14, 10), partScore(3, 3), partScore(34, 20)])).toBe(76);
    expect(tierForRating(76)).toBe('guld');
  });

  it('har ingen nästa nivå på ikon', () => {
    const s = buildCardStats(daily(200), TODAY);
    expect(s.tier).toBe('ikon');
    expect(s.next).toBeNull();
  });
});

describe('teamCards', () => {
  it('ger alla spelare ett betyg, högst först, och markerar mig', () => {
    const logs = [...daily(20).map((l) => ({ ...l, playerId: 'a' })), ...daily(2).map((l) => ({ ...l, playerId: 'me' }))];
    const cards = teamCards(logs, ['me', 'a', 'tom'], 'me', TODAY);
    expect(cards.map((c) => c.isMe)).toEqual([false, true, false]);
    expect(cards[0].rating).toBeGreaterThan(cards[1].rating);
    expect(cards[2]).toEqual({ rating: 40, tier: 'brons', isMe: false });
  });

  it('ignorerar loggar från den som inte är spelare (t.ex. tränaren)', () => {
    const cards = teamCards(daily(30).map((l) => ({ ...l, playerId: 'coach' })), ['a'], 'a', TODAY);
    expect(cards).toEqual([{ rating: 40, tier: 'brons', isMe: true }]);
  });

  it('snittet avrundas och är 0 för ett tomt lag', () => {
    expect(teamAverage([])).toBe(0);
    expect(teamAverage([{ rating: 70, tier: 'guld', isMe: false }, { rating: 75, tier: 'guld', isMe: true }])).toBe(73);
  });
});
