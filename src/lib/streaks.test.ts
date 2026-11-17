import { describe, expect, it } from 'vitest';
import { dayStreak, weekStreak } from './streaks';
import type { ISODate } from './types';

const S = (...dates: ISODate[]) => new Set<ISODate>(dates);

describe('dayStreak', () => {
  it('tom mängd ger 0', () => {
    expect(dayStreak(S(), '2026-11-18')).toEqual({ current: 0, frozenDates: [] });
  });

  it('räknar dagar i rad inklusive idag', () => {
    expect(dayStreak(S('2026-11-16', '2026-11-17', '2026-11-18'), '2026-11-18').current).toBe(3);
  });

  it('idag pågår: inaktiv idag bryter inte och förbrukar ingen frysdag', () => {
    const r = dayStreak(S('2026-11-16', '2026-11-17'), '2026-11-18');
    expect(r.current).toBe(2);
    expect(r.frozenDates).toEqual([]);
  });

  it('en missad dag per vecka fryses', () => {
    const r = dayStreak(S('2026-11-16', '2026-11-18'), '2026-11-18');
    expect(r.current).toBe(2);
    expect(r.frozenDates).toEqual(['2026-11-17']);
  });

  it('två missar samma vecka nollställer', () => {
    expect(dayStreak(S('2026-11-16', '2026-11-19'), '2026-11-19').current).toBe(1);
  });

  it('en frysdag per vecka, över veckogräns', () => {
    expect(dayStreak(S('2026-11-14', '2026-11-16', '2026-11-18'), '2026-11-18').current).toBe(3);
  });

  it('söndag aktiv, måndag frusen, tisdag = idag', () => {
    expect(dayStreak(S('2026-11-15'), '2026-11-17').current).toBe(1);
  });

  it('streak över sommartidsbytet', () => {
    const r = dayStreak(S('2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'), '2026-03-30');
    expect(r.current).toBe(4);
  });

  it('frusna dagar före äldsta aktiva dagen rapporteras inte', () => {
    expect(dayStreak(S('2026-11-18'), '2026-11-18')).toEqual({ current: 1, frozenDates: [] });
  });

  it('frozenDates är stigande när flera', () => {
    // v46: tis 10 frusen; v47: tis 17 frusen
    const r = dayStreak(
      S('2026-11-09', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-18'),
      '2026-11-18',
    );
    expect(r.current).toBe(8);
    expect(r.frozenDates).toEqual(['2026-11-10', '2026-11-17']);
  });
});

describe('weekStreak', () => {
  it('innevarande vecka pågår', () => {
    expect(weekStreak(new Set(['2026-W45', '2026-W46']), '2026-11-18')).toBe(2);
  });
  it('innevarande vecka klar räknas med', () => {
    expect(weekStreak(new Set(['2026-W45', '2026-W46', '2026-W47']), '2026-11-22')).toBe(3);
  });
  it('missad förra vecka ger 0', () => {
    expect(weekStreak(new Set(['2026-W45']), '2026-11-18')).toBe(0);
  });
  it('tom mängd ger 0', () => {
    expect(weekStreak(new Set(), '2026-11-18')).toBe(0);
  });
});
