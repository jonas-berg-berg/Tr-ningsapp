import { describe, expect, it } from 'vitest';
import { buildCardStats, TIERS } from './card';
import { addDays } from './dates';
import { nextLevel, passGain, recordNudges, streakAlert } from './triggers';
import type { ISODate, LogEntry } from './types';

// Onsdag.
const TODAY = '2026-11-18';

function log(date: ISODate, i = 0): LogEntry {
  return { id: `${date}-${i}`, playerId: 'p', date, type: 'extra', eventUid: null, otherKind: null, missionId: 'm', km: null };
}

/** En logg per dag, n dagar bakåt som slutar `end`. */
function daily(n: number, end: ISODate = TODAY): LogEntry[] {
  return Array.from({ length: n }, (_, i) => log(addDays(end, -i)));
}

describe('nextLevel', () => {
  it('räknar pass till nästa nivå, och så många pass når faktiskt nivån', () => {
    const logs = daily(2);
    const stats = buildCardStats(logs, TODAY);
    const next = nextLevel(logs, TODAY, TODAY, stats)!;
    expect(next.tier).toBe(stats.next!.tier);
    expect(next.passesLeft).toBeGreaterThan(0);
    const extra = Array.from({ length: next.passesLeft! }, (_, i) => log(TODAY, i + 1));
    const min = TIERS.find((t) => t.tier === next.tier)!.min;
    expect(buildCardStats([...logs, ...extra], TODAY).rating).toBeGreaterThanOrEqual(min);
    const oneLess = extra.slice(1);
    expect(buildCardStats([...logs, ...oneLess], TODAY).rating).toBeLessThan(min);
  });

  it('är null på högsta nivån', () => {
    const logs = Array.from({ length: 200 }, (_, i) => log(addDays(TODAY, -(i % 60)), i));
    const stats = buildCardStats(logs, TODAY);
    expect(stats.next).toBeNull();
    expect(nextLevel(logs, TODAY, TODAY, stats)).toBeNull();
  });
});

describe('passGain', () => {
  it('första passet idag ger betyg och förlänger streaken', () => {
    const logs = daily(3, addDays(TODAY, -1));
    const gain = passGain(logs, TODAY, TODAY, buildCardStats(logs, TODAY));
    expect(gain.rating).toBeGreaterThan(0);
    expect(gain.streak).toBe(true);
  });

  it('ett andra pass samma dag förlänger inte streaken', () => {
    const logs = daily(3);
    expect(passGain(logs, TODAY, TODAY, buildCardStats(logs, TODAY)).streak).toBe(false);
  });
});

describe('streakAlert', () => {
  it('ingen varning om man redan har loggat idag eller saknar streak', () => {
    expect(streakAlert(daily(5), TODAY, 20)).toBeNull();
    expect(streakAlert([], TODAY, 20)).toBeNull();
  });

  it('en vänlig puff före kl. 17, bara vid minst 2 dagar', () => {
    expect(streakAlert(daily(4, addDays(TODAY, -1)), TODAY, 10)).toEqual({ level: 'hint', streak: 4 });
    expect(streakAlert(daily(1, addDays(TODAY, -1)), TODAY, 10)).toBeNull();
  });

  it('kvällstid: frysdagen räddar streaken om den inte är använd', () => {
    expect(streakAlert(daily(4, addDays(TODAY, -1)), TODAY, 18)).toEqual({ level: 'freeze', streak: 4 });
  });

  it('kvällstid: streaken tar slut om veckans frysdag redan är använd', () => {
    // Måndag missad (frysdag), tisdag aktiv, onsdag (idag) inget än.
    const logs = [log('2026-11-17'), ...daily(5, '2026-11-15')];
    expect(streakAlert(logs, TODAY, 18)).toEqual({ level: 'urgent', streak: 6 });
  });
});

describe('recordNudges', () => {
  it('ett pass idag slår streakrekordet', () => {
    // Gammal streak på 5, sedan uppehåll, nu 5 dagar i rad till igår.
    const logs = [...daily(5, '2026-10-20'), ...daily(5, addDays(TODAY, -1))];
    expect(recordNudges(logs, TODAY)[0]).toMatchObject({ text: 'Ett pass idag slår ditt streakrekord på 5 dagar!', celebrate: false });
  });

  it('firar nytt streakrekord', () => {
    const logs = [...daily(4, '2026-10-20'), ...daily(6)];
    expect(recordNudges(logs, TODAY).map((n) => n.text)).toContain('Nytt streakrekord: 6 dagar!');
  });

  it('säger hur många dagar som är kvar när rekordet är nära', () => {
    const logs = [...daily(8, '2026-10-20'), ...daily(6)];
    expect(recordNudges(logs, TODAY).map((n) => n.text)).toContain('3 dagar kvar till nytt streakrekord (8 dagar)');
  });

  it('nästa pass blir ett jämnt antal', () => {
    const logs = Array.from({ length: 24 }, (_, i) => log('2026-09-01', i));
    expect(recordNudges(logs, TODAY)[0].text).toBe('Nästa pass blir ditt 25:e!');
  });

  it('firar ett jämnt antal som nåddes idag', () => {
    const logs = [...Array.from({ length: 9 }, (_, i) => log('2026-09-01', i)), log(TODAY)];
    expect(recordNudges(logs, TODAY).map((n) => n.text)).toContain('Pass nummer 10 avklarat!');
  });

  it('ett pass till ger bästa veckan hittills', () => {
    // Förra veckan 4 pass, denna vecka (mån–ons) 4 pass.
    const prev = Array.from({ length: 4 }, (_, i) => log('2026-11-10', i));
    const now = [log('2026-11-16', 0), log('2026-11-16', 1), log('2026-11-17'), log(TODAY)];
    expect(recordNudges([...prev, ...now], TODAY).map((n) => n.text)).toContain('Ett pass till så är det din bästa vecka hittills');
  });

  it('inga puffar för en ny spelare', () => {
    expect(recordNudges([], TODAY)).toEqual([]);
  });
});
