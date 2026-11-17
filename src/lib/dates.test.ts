import { describe, expect, it } from 'vitest';
import { addDays, isoWeekKey, isoWeekday, stockholmHour, toStockholmDate, weekDates } from './dates';

describe('toStockholmDate', () => {
  it('använder lokal dag vintertid', () => {
    expect(toStockholmDate(new Date('2026-11-17T22:30:00Z'))).toBe('2026-11-17');
    expect(toStockholmDate(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18');
  });
  it('hanterar sommartid och omställningsnatt', () => {
    expect(toStockholmDate(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
    expect(toStockholmDate(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25');
  });
});

describe('isoWeekKey', () => {
  it('ger måndag–söndag samma vecka', () => {
    expect(isoWeekKey('2026-11-16')).toBe('2026-W47');
    expect(isoWeekKey('2026-11-22')).toBe('2026-W47');
  });
  it('hanterar årsskifte', () => {
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
  });
});

describe('addDays', () => {
  it('går över sommartidsomställning', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});

describe('isoWeekday', () => {
  it('söndag är 7', () => {
    expect(isoWeekday('2026-11-22')).toBe(7);
  });
});

describe('stockholmHour', () => {
  it('ger lokal timme vinter och sommar', () => {
    expect(stockholmHour(new Date('2026-11-17T18:00:00Z'))).toBe(19);
    expect(stockholmHour(new Date('2026-07-01T17:00:00Z'))).toBe(19);
  });
});

describe('weekDates', () => {
  it('ger sju datum från måndag', () => {
    expect(weekDates('2026-W47')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ]);
  });
});
