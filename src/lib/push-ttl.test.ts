import { describe, expect, it } from 'vitest';
import { secondsUntilStockholmMidnight } from './push-ttl';

describe('secondsUntilStockholmMidnight', () => {
  it('kl 19 vintertid: 5 timmar kvar', () => {
    expect(secondsUntilStockholmMidnight(new Date('2026-11-18T18:00:00Z'))).toBe(5 * 3600);
  });
  it('söndag kl 15 sommartid: 9 timmar kvar', () => {
    expect(secondsUntilStockholmMidnight(new Date('2026-06-14T13:00:00Z'))).toBe(9 * 3600);
  });
  it('dagen klockan ställs fram (23-timmarsdygn)', () => {
    // 2027-03-28 01:30 vintertid; midnatt är 2027-03-28T22:00Z.
    expect(secondsUntilStockholmMidnight(new Date('2027-03-28T00:30:00Z'))).toBe(21.5 * 3600);
  });
  it('dagen klockan ställs tillbaka (25-timmarsdygn)', () => {
    // 2026-10-25 00:30 sommartid; midnatt är 2026-10-25T23:00Z.
    expect(secondsUntilStockholmMidnight(new Date('2026-10-24T22:30:00Z'))).toBe(24.5 * 3600);
  });
  it('minst 60 sekunder', () => {
    expect(secondsUntilStockholmMidnight(new Date('2026-11-18T22:59:30Z'))).toBe(60);
  });
});
